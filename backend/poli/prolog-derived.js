common
   arraysEqual
   assert
   hasOwnProperty
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   indexRange
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
   indexMultiAt
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

   let subProjs = [];
   let subVers = [];

   for (let conj of config.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subProjs.push(proj);
      subVers.push(null);
   }

   let subIndexInstances = Array.from(
      config.appliedIndices,
      index => $.refIndexInstance(subProjs[index.forConj.num], index)
   );

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: false,
      boundAttrs: boundAttrs,
      config: config,
      subProjs: subProjs,
      subVers: subVers,
      subIndexInstances: subIndexInstances,
      myVer: null,
      value: null,  // lean in the beginning
      tupleDeps: new Map,
      indexInstances: [],
      validRevDeps: new Set,
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxInst of proj.subIndexInstances) {
      $.releaseIndexInstance(idxInst);
   }

   for (let subVer of proj.subVers) {
      $.releaseVersion(subVer);
   }

   for (let subProj of proj.subProjs) {
      subProj.validRevDeps.delete(proj);
      $.releaseProjection(subProj);
   }
}
markProjectionValid ::= function (proj) {
   for (let subProj of proj.subProjs) {
      subProj.validRevDeps.add(proj);
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
   let [subproj0] = proj.subProjs;

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   for (let i = 0; i < proj.subVers.length; i += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subProjs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(proj.subProjs[i]);
      if (proj.subVers[i] !== null) {
         $.releaseVersion(proj.subVers[i]);
      }
      proj.subVers[i] = newVer;
   }

   let ns = Object.fromEntries(
      $.map($.conjunct.lvarsIn(conj0), lvar => [lvar, undefined])
   );
   let subTuples = [];

   function run(k) {
      if (k === jpath0.length) {
         let tuple = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

         $.depTuple(proj.tupleDeps, tuple, subTuples);

         proj.value.add(tuple);

         return;
      }

      let {conj, index, checkAttrs, extractAttrs} = jpath0[k];
      let source;

      if (index === null) {
         source = proj.subProjs[conj.num].value;
      }
      else {
         source = $.indexMultiAt(
            proj.subIndexInstances[index.num], attr => ns[conj.looseAttrs[attr]]
         );
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

         subTuples.push(tuple);
         run(k + 1);
         subTuples.pop();
      }
   }

   proj.value = new Set();

   for (let tuple of subproj0.value) {
      for (let [attr, lvar] of Object.entries(conj0.looseAttrs)) {
         ns[lvar] = tuple[attr];
      }

      subTuples.push(tuple);
      run(0);
      subTuples.pop(tuple);
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

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   // subDeltas: conj => delta
   let subDeltas = new Map(
      $.mapfilter(proj.config.conjs, conj => {
         let subVer = proj.subVers[conj.num];
         if (!$.isVersionUpToDate(subVer)) {
            $.unchainVersions(subVer);
            return [conj, subVer.delta];
         }
      })
   );

   // Remove
   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   for (let [conj, subDelta] of subDeltas) {
      for (let [subTuple, action] of subDelta) {
         if (action === 'remove') {
            let tuples = $.undepSubtuple(proj.tupleDeps, subTuple);

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
   for (let [dconj, subDelta] of subDeltas) {
      let jpath = proj.config.jpaths[dconj.num];

      let ns = Object.fromEntries(
         $.map($.conjunct.lvarsIn(dconj), lvar => [lvar, undefined])
      );
      let subTuples = [];

      function run(k) {
         if (k === jpath.length) {
            let tuple = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

            $.depTuple(proj.tupleDeps, tuple, subTuples);

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
            source = proj.subProjs[conj.num].value;
         }
         else {
            source = $.indexMultiAt(
               proj.subIndexInstances[index.num], attr => ns[conj.looseAttrs[attr]]
            );
         }

         // noDelta is used to exclude tuples that belong to deltas of already-processed
         // conjuncts (as we process in order, an already processed is the one with lesser
         // number)
         let noDelta = conj.num < dconj.num ? subDeltas.get(conj) || null : null;
         
         outer:
         for (let tuple of source) {
            if (noDelta !== null && noDelta.has(tuple)) {
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

            subTuples.push(tuple);
            run(k + 1);
            subTuples.pop();
         }
      }

      for (let [subTuple, action] of subDelta) {
         if (action === 'add') {
            for (let [attr, lvar] of Object.entries(dconj.looseAttrs)) {
               ns[lvar] = subTuple[attr];
            }
            
            subTuples.push(subTuple);
            run(0);
            subTuples.pop();
         }
      }
   }

   // Finally ref new sub versions
   for (let conj of subDeltas.keys()) {
      let newVer = $.refCurrentState(proj.subProjs[conj.num]);
      $.releaseVersion(proj.subVers[conj.num]);
      proj.subVers[conj.num] = newVer;
   }

   $.markProjectionValid(proj);
}
undepSubtuple ::= function (deps, subTuple) {
   let tupleSet = deps.get(subTuple);

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
depTuple ::= function (deps, tuple, subTuples) {
   deps.set(tuple, Array.from(subTuples));

   for (let subTuple of subTuples) {
      $.setDefault(deps, subTuple, () => new Set).add(tuple);
   }
}