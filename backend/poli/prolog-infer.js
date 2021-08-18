common
   arraysEqual
   assert
   hasOwnProperty
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   hasNoEnumerableProps
   singleQuoteJoinComma
   map
   mapfilter
   filter
prolog-projection
   projectionFor
   releaseProjection
prolog-conjunct
   * as: conjunct
prolog-fact
   refIndex
   releaseIndex
prolog-version
   refCurrentState
   releaseVersion
prolog-index
   copyIndex
   isIndexCovered
prolog-update-scheme
   computeIncrementalUpdateScheme
-----
inferredRelation ::= function (callback) {
   let lvname = Symbol('lvar');
   let vpool = new Map;

   function getvar(name) {
      if (!vpool.has(name)) {
         vpool.set(name, {
            [lvname]: name,
         });
      }

      return vpool.get(name);    
   }

   let relspec = callback(function (strings) {
      if (strings.length !== 1) {
         throw new Error(`Logical variable names don't support inline expressions`);
      }

      let [name] = strings;

      return getvar(name);
   });

   // Ensure the implicit lvars that correspond to the attrs are in the pool. If they are
   // not by now, this is an error anyways, but we still want them to be in the vpool.
   for (let attr of relspec.attrs) {
      getvar(attr);
   }

   for (let conjspec of relspec.body) {
      let invalidAttrs = $.conjunct.specInvalidAttrs(conjspec);

      if (invalidAttrs.length > 0) {
         throw new Error(
            `Relation '${relspec.name}': missing attr(s) ` +
            `${$.singleQuoteJoinComma(invalidAttrs)} in conjunct '${conjspec.rel.name}'`
         );
      }
   }

   let conjs = Array.from(relspec.body, spec => $.conjunct.fromSpec(spec, lvname));

   // Give all the conjuncts numbers from 0 to N-1
   for (let i = 0; i < conjs.length; i += 1) {
      conjs[i].num = i;
   }

   for (let conj of conjs) {
      let dupVar = $.conjunct.duplicateVarIn(conj);

      if (dupVar !== null) {
         throw new Error(
            `Relation '${relspec.name}': duplicate var '${dupVar}' in conjunct ` +
            `'${conj.rel.name}'`
         );
      }
   }

   let lvars = Array.from(vpool.keys());

   {
      let {met, unmet} = $.conjunct.varUsageSanity(lvars, relspec.attrs, conjs);

      if (unmet.size > 0) {
         let names = $.singleQuoteJoinComma(unmet);
         throw new Error(`Relation '${relspec.name}': lvars not used anywhere: ${names}`);
      }

      if (met.size > 0) {
         let names = $.singleQuoteJoinComma(met);
         throw new Error(
            `Relation '${relspec.name}': lvars mentioned once but otherwise not used: ${names}`
         );
      }
   }
   
   $.assert(relspec.indices === undefined);

   let {jpaths, appliedIndices} = $.computeIncrementalUpdateScheme(relspec.name, conjs);

   return {
      isFactual: false,
      name: relspec.name,
      attrs: relspec.attrs,
      lvars: lvars,
      conjs: conjs,
      indices: [],  // TODO: implement indices
      jpaths: jpaths,
      appliedIndices: appliedIndices,
      projmap: new Map,
   };
}
makeProjection ::= function (rel, boundAttrs) {
   $.assert($.hasNoEnumerableProps(boundAttrs));

   let subprojs = [];
   let basevers = [];

   for (let conj of rel.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subprojs.push(proj);
      basevers.push($.refCurrentState(proj));
   }

   let idxobjs = [];

   for (let index of rel.appliedIndices) {
      idxobjs.push($.refIndex(subprojs[index.numConj], index));
   }

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: true,
      boundAttrs: boundAttrs,
      subprojs: subprojs,
      basevers: basevers,
      idxobjs: idxobjs,
      latestVersion: null,
      value: null,  // will be initialized shortly
      indices: [],
      validRevDeps: new Set,
   };

   for (let subproj of subprojs) {
      subproj.validRevDeps.add(proj);
   }

   proj.value = $.runProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxobj of proj.idxobjs) {
      $.releaseIndex(idxobj);
   }

   for (let ver of proj.basevers) {
      $.releaseVersion(ver);
   }

   for (let subproj of proj.subprojs) {
      subproj.validRevDeps.delete(proj);
      $.releaseProjection(subproj);
   }
}
runProjection ::= function (proj) {
   let {rel} = proj;
   let conj0 = rel.conjs[0];
   let jpath = rel.jpaths[0];
   let subproj0 = proj.subprojs[0];

   let ns = Object.fromEntries(
      $.map($.conjunct.lvarsIn(conj0), lvar => [lvar, undefined])
   );
   let subtuples = [];

   function* gen(i) {
      if (i === jpath.length) {
         let tuple = Object.fromEntries($.map(rel.attrs, a => [a, ns[a]]));

         Object.defineProperty(tuple, $.symDeps, {
            value: Array.from(subtuples)
         });
         
         yield tuple;

         return;
      }

      let jplink = jpath[i];
      let source;

      if (jplink.index === null) {
         source = proj.subprojs[jplink.conj.num].value;
      }
      else {
         let idxobj = proj.idxobjs[jplink.indexNum];

         source = idxobj.value;
         
         for (let attr of idxobj) {
            let lvar = jplink.conj.looseAttrs[attr];
            source = source.get(ns[lvar]);

            if (source === undefined) {
               return;
            }
         }

         if (idxobj.isUnique) {
            source = [source];
         }
      }
      
      outer:
      for (let tuple of source) {
         for (let [attr, lvar] of jplink.checkAttrs) {
            if (tuple[attr] !== ns[lvar]) {
               continue outer;
            }
         }

         for (let [attr, lvar] of jplink.extractAttrs) {
            ns[lvar] = tuple[attr];
         }

         subtuples.push(tuple);
         yield* gen(i + 1);
         subtuples.pop();
      }
   }

   function* gen0() {
      for (let tuple of subproj0.value) {
         for (let [attr, lvar] of Object.entries(conj0.looseAttrs)) {
            ns[lvar] = tuple[attr];
         }

         subtuples.push(tuple);
         yield* gen(0);
         subtuples.pop(tuple);
      }
   }

   return Array.from(gen0());
}
symDeps ::= Symbol.for('poli.tuple.deps')
