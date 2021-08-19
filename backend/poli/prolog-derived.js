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
prolog-base
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
derivedRelation ::= function (callback) {
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
      isBase: false,
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
   let depVers = [];

   for (let conj of rel.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subprojs.push(proj);
      depVers.push(null);
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
      depVers: depVers,
      idxobjs: idxobjs,
      myVer: null,
      value: null,
      tupleDeps: new Map,
      indices: [],  // TODO: implement indices for derived projections
      validRevDeps: new Set,
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxobj of proj.idxobjs) {
      $.releaseIndex(idxobj);
   }

   for (let ver of proj.depVers) {
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
   $.assert(proj.myVer === null);

   let {rel} = proj;
   let {conjs: [conj0], jpaths: [jpath0]} = rel;
   let [subproj0] = proj.subprojs;

   for (let subproj of proj.subprojs) {
      $.gUpdateProjection(subproj);
   }

   for (let i = 0; i < proj.depVers.length; i += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subprojs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(proj.subprojs[i]);
      if (proj.depVers[i] !== null) {
         $.releaseVersion(proj.depVers[i]);
      }
      proj.depVers[i] = newVer;
   }

   let ns = Object.fromEntries(
      $.map($.conjunct.lvarsIn(conj0), lvar => [lvar, undefined])
   );
   let subtuples = [];

   function run(k) {
      if (k === jpath0.length) {
         let tuple = Object.fromEntries($.map(rel.attrs, a => [a, ns[a]]));

         $.depTuple(proj.tupleDeps, tuple, subtuples);

         proj.value.add(tuple);

         return;
      }

      let jplink = jpath0[k];
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
         run(k + 1);
         subtuples.pop();
      }
   }

   proj.value = new Set();

   for (let tuple of subproj0.value) {
      for (let [attr, lvar] of Object.entries(conj0.looseAttrs)) {
         ns[lvar] = tuple[attr];
      }

      subtuples.push(tuple);
      run(0);
      subtuples.pop(tuple);
   }
  
   $.markProjectionValid(proj);
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if (proj.value === null) {
      // This is a 'lean' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let subproj of proj.subprojs) {
      $.gUpdateProjection(subproj);
   }

   // newDepVers: conj => newDepVer
   // Invariant: all 'conj' go in increasing number (conj0.num < conj1.num < ...)
   let newDepVers = new Map;

   for (let conj of proj.rel.conjs) {
      let depVer = proj.depVers[conj.num];
      
      if ($.isVersionUpToDate(depVer)) {
         continue;
      }

      let subproj = proj.subprojs[conj.num];
      let newDepVer = $.refCurrentState(subproj);  // reference already added

      $.assert(depVer !== newDepVer);

      $.unchainVersions(depVer);
      newDepVers.set(conj, newDepVer);
   }

   if (newDepVers.size === 0) {
      $.markProjectionValid(proj);
      return;
   }

   // Remove
   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   for (let conj of newDepVers.keys()) {
      let subdelta = proj.depVers[conj.num].delta;
      $.assert(subdelta.size > 0);

      for (let [subtuple, action] of subdelta) {
         if (action === 'remove') {
            let tuples = $.undepSubtuple(proj.tupleDeps, subtuple);

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

   // Add
   for (let dconj of newDepVers.keys()) {
      let jpath = proj.rel.jpaths[dconj.num];

      let ns = Object.fromEntries(
         $.map($.conjunct.lvarsIn(dconj), lvar => [lvar, undefined])
      );
      let subtuples = [];

      function run(k) {
         if (k === jpath.length) {
            let tuple = Object.fromEntries($.map(proj.rel.attrs, a => [a, ns[a]]));

            $.depTuple(proj.tupleDeps, tuple, subtuples);

            proj.value.add(tuple);

            if (delta !== null) {
               $.deltaAdd(delta, tuple, 'add');
            }

            return;
         }

         let {conj, index, indexNum, checkAttrs, extractAttrs} = jpath[k];
         let source;

         if (index === null) {
            source = proj.subprojs[conj.num].value;
         }
         else {
            let idxobj = proj.idxobjs[indexNum];

            source = idxobj.value;
            
            for (let attr of idxobj) {
               let lvar = conj.looseAttrs[attr];
               source = source.get(ns[lvar]);

               if (source === undefined) {
                  return;
               }
            }

            if (idxobj.isUnique) {
               source = [source];
            }
         }

         // noDelta is used to exclude tuples that belong to deltas of already-processed
         // conjuncts (as we process in order, an already processed is the one with lesser
         // number)
         let noDelta;

         if (conj.num < dconj.num && newDepVers.has(conj)) {
            noDelta = proj.depVers[conj.num].delta;
         }
         else {
            noDelta = new Map;
         }
         
         outer:
         for (let tuple of source) {
            if (noDelta.has(tuple)) {
               continue;
            }

            for (let [attr, lvar] of checkAttrs) {
               if (tuple[attr] !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let [attr, lvar] of extractAttrs) {
               ns[lvar] = tuple[attr];
            }

            subtuples.push(tuple);
            run(k + 1);
            subtuples.pop();
         }
      }

      let subdelta = proj.depVers[dconj.num].delta;

      for (let [subtuple, action] of subdelta) {
         if (action === 'add') {
            for (let [attr, lvar] of Object.entries(dconj.looseAttrs)) {
               ns[lvar] = subtuple[attr];
            }
            
            subtuples.push(subtuple);
            run(0);
            subtuples.pop();
         }
      }
   }

   // Finally release old dependent versions
   for (let [conj, newDepVer] of newDepVers) {
      $.releaseVersion(proj.depVers[conj.num]);
      proj.depVers[conj.num] = newDepVer;
   }

   $.markProjectionValid(proj);
}
undepSubtuple ::= function (deps, subtuple) {
   let tupleSet = deps.get(subtuple);

   if (tupleSet === undefined) {
      return [];
   }

   let tuples = Array.from(tupleSet);

   for (let tuple of tuples) {
      $.undepTuple(deps, tuple);
   }

   return tuples;
}
undepTuple ::= function (deps, tuple) {
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
depTuple ::= function (deps, tuple, subtuples) {
   deps.set(tuple, Array.from(subtuples));

   for (let subtuple of subtuples) {
      $.setDefault(deps, subtuple, () => new Set).add(tuple);
   }
}