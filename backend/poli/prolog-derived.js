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
prolog-version
   refCurrentState
   releaseVersion
   isVersionUpToDate
   deltaAdd
   unchainVersions
prolog-index
   indexOn
   copyIndex
   isIndexCovered
   indexAdd
   indexRemove
prolog-index-instance
   refIndexInstance
   releaseIndexInstance
prolog-update-scheme
   computeIncrementalUpdateScheme
   narrowConfig
-----
MAX_REL_ATTRS ::= 30
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

   if (relspec.attrs.length > $.MAX_REL_ATTRS) {
      throw new Error(`Relation '${relspec.name}': too many attributes`);
   }

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
   
   let {jpaths, appliedIndices} = $.computeIncrementalUpdateScheme(relspec.name, conjs);
   let config0 = {
      conjs: conjs,
      attrs: relspec.attrs,
      jpaths: jpaths,
      appliedIndices: appliedIndices,
   };

   return {
      isBase: false,
      name: relspec.name,
      attrs: relspec.attrs,
      lvars: lvars,
      conjs: conjs,
      indices: Array.from(relspec.indices || [], $.indexOn),
      configs: {0: config0},
      projmap: new Map,
   };
}
makeProjection ::= function (rel, boundAttrs) {
   let config = $.configFor(rel, boundAttrs);

   let subprojs = [];
   let depVers = [];

   for (let conj of config.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subprojs.push(proj);
      depVers.push(null);
   }

   let depIndexInstances = Array.from(
      config.appliedIndices,
      index => $.refIndexInstance(subprojs[index.forConj.num], index)
   );

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: false,
      boundAttrs: boundAttrs,
      config: config,
      subprojs: subprojs,
      depVers: depVers,
      depIndexInstances: depIndexInstances,
      myVer: null,
      value: null,
      tupleDeps: new Map,
      indexInstances: [],
      validRevDeps: new Set,
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxInst of proj.depIndexInstances) {
      $.releaseIndexInstance(idxInst);
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
configFor ::= function (rel, boundAttrs) {
   let cfgkey = $.boundAttrs2ConfigKey(rel.attrs, boundAttrs);

   if (!$.hasOwnProperty(rel.configs, cfgkey)) {
      rel.configs[cfgkey] = $.narrowConfig(rel.configs[0], boundAttrs);
   }
   
   return rel.configs[cfgkey];
}
boundAttrs2ConfigKey ::= function (attrs, boundAttrs) {
   let cfgkey = 0;

   for (let i = 0; i < attrs.length; i += 1) {
      if ($.hasOwnProperty(boundAttrs, attrs[i])) {
         cfgkey |= (1 << i);
      }
   }

   return cfgkey;
}
rebuildProjection ::= function (proj) {
   // It is only possible to rebuild a projection that nobody refers to.
   $.assert(proj.myVer === null);

   let {rel} = proj;
   let {conjs: [conj0], jpaths: [jpath0]} = proj.config;
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
         let tuple = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

         $.depTuple(proj.tupleDeps, tuple, subtuples);

         proj.value.add(tuple);

         return;
      }

      let {conj, index, checkAttrs, extractAttrs} = jpath0[k];
      let source;

      if (index === null) {
         source = proj.subprojs[conj.num].value;
      }
      else {
         let idxInst = proj.depIndexInstances[index.num];

         source = idxInst.value;
         
         for (let attr of idxInst) {
            let lvar = conj.looseAttrs[attr];
            source = source.get(ns[lvar]);

            if (source === undefined) {
               return;
            }
         }

         if (idxInst.isUnique) {
            source = [source];
         }
      }
      
      outer:
      for (let tuple of source) {
         for (let attr of checkAttrs) {
            let lvar = conj.looseAttrs[attr];
            if (tuple[attr] !== ns[lvar]) {
               continue outer;
            }
         }

         for (let attr of extractAttrs) {
            let lvar = conj.looseAttrs[attr];
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
   // ?TODO: restructure to work across an array of deltas (which may be 0-sized) instead
   // of new versions?
   let newDepVers = new Map;

   for (let conj of proj.config.conjs) {
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

            for (let idxInst of proj.indexInstances) {
               for (let tuple of tuples) {
                  $.indexRemove(idxInst, tuple);
               }
            }
         }
      }
   }

   // Add
   for (let dconj of newDepVers.keys()) {
      let jpath = proj.config.jpaths[dconj.num];

      let ns = Object.fromEntries(
         $.map($.conjunct.lvarsIn(dconj), lvar => [lvar, undefined])
      );
      let subtuples = [];

      function run(k) {
         if (k === jpath.length) {
            let tuple = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

            $.depTuple(proj.tupleDeps, tuple, subtuples);

            proj.value.add(tuple);

            if (delta !== null) {
               $.deltaAdd(delta, tuple, 'add');
            }

            for (let idxInst of proj.indexInstances) {
               $.indexAdd(idxInst, tuple);
            }

            return;
         }

         let {conj, index, checkAttrs, extractAttrs} = jpath[k];
         let source;

         if (index === null) {
            source = proj.subprojs[conj.num].value;
         }
         else {
            let idxInst = proj.depIndexInstances[index.num];

            source = idxInst.value;
            
            for (let attr of idxInst) {
               let lvar = conj.looseAttrs[attr];
               source = source.get(ns[lvar]);

               if (source === undefined) {
                  return;
               }
            }

            if (idxInst.isUnique) {
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

            for (let attr of checkAttrs) {
               let lvar = conj.looseAttrs[attr];
               if (tuple[attr] !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let attr of extractAttrs) {
               let lvar = conj.looseAttrs[attr];
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