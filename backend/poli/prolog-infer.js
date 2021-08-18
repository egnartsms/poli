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
   setDefault
prolog-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
prolog-conjunct
   * as: conjunct
prolog-fact
   refIndex
   releaseIndex
prolog-version
   refCurrentState
   releaseVersion
   isVersionUpToDate
   deltaAdd
   unchainVersions
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
   let baseVers = [];

   for (let conj of rel.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subprojs.push(proj);
      baseVers.push(null);
   }

   let idxobjs = [];

   for (let index of rel.appliedIndices) {
      idxobjs.push($.refIndex(subprojs[index.numConj], index));
   }

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: false,
      boundAttrs: boundAttrs,
      subprojs: subprojs,
      baseVers: baseVers,
      idxobjs: idxobjs,
      latestVersion: null,
      value: null,
      tupleDeps: null,
      indices: [],  // TODO: implement indices for inferred projections
      validRevDeps: new Set,
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxobj of proj.idxobjs) {
      $.releaseIndex(idxobj);
   }

   for (let ver of proj.baseVers) {
      $.releaseVersion(ver);
   }

   for (let subproj of proj.subprojs) {
      subproj.validRevDeps.delete(proj);
      $.releaseProjection(subproj);
   }
}
markProjectionValid ::= function (proj) {
   for (let subproj of proj.subprojs) {
      subproj.validRevDeps.add(proj);
   }

   proj.isValid = true;
}
rebuildProjection ::= function (proj) {
   // It is only possible to rebuild a projection that nobody refers to.
   $.assert(proj.latestVersion === null);

   let {rel} = proj;
   let {conjs: [conj0], jpaths: [jpath0]} = rel;
   let [subproj0] = proj.subprojs;

   for (let subproj of proj.subprojs) {
      $.gUpdateProjection(subproj);
   }

   for (let i = 0; i < proj.baseVers.length; i += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subprojs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(proj.subprojs[i]);
      if (proj.baseVers[i] !== null) {
         $.releaseVersion(proj.baseVers[i]);
      }
      proj.baseVers[i] = newVer;
   }

   let tupleDeps = new Map;
   let ns = Object.fromEntries(
      $.map($.conjunct.lvarsIn(conj0), lvar => [lvar, undefined])
   );
   let subtuples = [];

   function* gen(i) {
      if (i === jpath0.length) {
         let tuple = Object.fromEntries($.map(rel.attrs, a => [a, ns[a]]));

         tupleDeps.set(tuple, Array.from(subtuples));

         for (let subtuple of subtuples) {
            $.setDefault(tupleDeps, subtuple, () => new Set).add(tuple);
         }
         
         yield tuple;

         return;
      }

      let jplink = jpath0[i];
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

   proj.value = new Set(gen0());
   proj.tupleDeps = tupleDeps;

   $.markProjectionValid(proj);
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if (proj.value === null) {
      // This is an 'empty' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let subproj of proj.subprojs) {
      $.gUpdateProjection(subproj);
   }

   let newBaseVers = new Array(proj.subprojs.length);
   let numSubChanged = 0;

   for (let i = 0; i < proj.subprojs.length; i += 1) {
      let subproj = proj.subprojs[i];
      let baseVer = proj.baseVers[i];
      let newBaseVer = null;

      if (!$.isVersionUpToDate(baseVer)) {
         newBaseVer = $.refCurrentState(subproj);  // reference already added

         $.assert(baseVer !== newBaseVer);

         $.unchainVersions(baseVer);
         numSubChanged += 1;
      }

      newBaseVers[i] = newBaseVer;
   }

   if (numSubChanged === 0) {
      $.markProjectionValid(proj);
      return;
   }

   // TODO: also update index objects of proj on all modifications

   // First handle all deletions
   let delta = proj.latestVersion !== null ? proj.latestVersion.delta : null;

   for (let i = 0; i < proj.subprojs.length; i += 1) {
      if (newBaseVers[i] === null) {
         continue;
      }

      let subdelta = proj.baseVers[i].delta;
      $.assert(subdelta.size > 0);

      for (let [subtuple, action] of subdelta) {
         if (action === 'remove') {
            let tuples = $.removeSubtuple(proj.tupleDeps, subtuple);

            for (let tuple of tuples) {
               proj.value.delete(tuple);
            }

            if (delta !== null) {
               for (let tuple of tuples) {
                  $.deltaAdd(delta, tuple, 'remove');
               }
            }

            // TODO: update indices
         }
      }
   }

   // TODO: handle additions

   // Finally release old base versions
   for (let i = 0; i < proj.subprojs.length; i += 1) {
      if (newBaseVers[i] !== null) {
         $.releaseVersion(proj.baseVers[i]);
         proj.baseVers[i] = newBaseVers[i];
      }
   }

   $.markProjectionValid(proj);
}
removeSubtuple ::= function (deps, subtuple) {
   let tupleSet = deps.get(subtuple);

   if (tupleSet === undefined) {
      return [];
   }

   let tuples = Array.from(tupleSet);

   for (let tuple of tuples) {
      $.removeTuple(deps, tuple);
   }

   return tuples;
}
removeTuple ::= function (deps, tuple) {
   let subs = deps.get(tuple);

   for (let sub of subs) {
      let tset = deps.get(sub);

      tset.delete(tuple);

      if (tset.size === 0) {
         deps.delete(sub);
      }
   }

   deps.delete(tuple);
}