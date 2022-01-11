common
   arraysEqual
   assert
   check
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   indexRange
   enumerate
   hasNoEnumerableProps
   hasOwnProperty
   hasOwnDefinedProperty
   singleQuoteJoinComma
   map
   mapfilter
   newObj
   ownEntries
   filter
   setDefault
   zip
   produceArray
   multimap
   mmapAdd
   mmapDelete
   range
   settify
set-map
   deleteAll
dedb-rec-key
   recKey
   recVal
   normalizeAttrs
dedb-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeProjectionRegistry
   projectionSizeEstimate
   projectionPairs
   projectionRvalAt
   projectionRvalAtX
dedb-goal
   * as: goal
dedb-version
   refCurrentState
   releaseVersion
   isVersionFresh
   unchainVersion
   multiVersionAddKey
   multiVersionRemoveKey
   versionAddedKeys
   versionRemovedKeys
   hasVersionAdded
dedb-index
   copyIndex
   indexFromSpec
dedb-index-instance
   refIndexInstance
   releaseIndexInstance
   indexAdd
   indexRemove
   indexRefPairs
dedb-join-plan
   computeIncrementalUpdatePlan
   narrowConfig
   clsJoinAll
   clsJoinIndex
   clsJoinRecKey
   clsJoinFunc
   clsJoinEither
dedb-relation
   recordCollection
-----
clsDerivedRelation ::= ({
   name: 'relation.derived',
   relation: true,
   'relation.derived': true
})
MAX_REL_ATTRS ::= 30
makeRelation ::= function ({
   name: relname,
   isKeyed = false,
   attrs = [],
   potentialIndices = [],
   body: bodyCallback
}) {
   $.check(isKeyed || attrs.length > 0);

   let logAttrs;

   if (isKeyed) {
      if (attrs.length === 0) {
         logAttrs = [$.recKey, $.recVal];
      }
      else {
         logAttrs = [$.recKey, ...attrs];
      }
   }
   else {
      logAttrs = attrs;
   }

   $.check(logAttrs.length <= $.MAX_REL_ATTRS, `Too many attributes`);

   function vTagged(strings) {
      if (strings.length !== 1) {
         throw new Error(`Variable names don't support inline expressions`);
      }

      let [name] = strings;

      return $.goal.makeLvar(name);
   }

   if (isKeyed) {
      Object.defineProperties(vTagged, {
         key: {
            get() {
               return $.goal.makeLvar($.recKey)
            }
         },
         value: {
            get() {
               return $.goal.makeLvar($.recVal)
            }
         }
      });
   }

   let rootGoal = bodyCallback(vTagged);

   if (rootGoal instanceof Array) {
      rootGoal = $.goal.and(...rootGoal);
   }
   
   let numProjs = $.goal.assignProjNumToRelGoals(rootGoal);
   let numDeps = $.goal.assignDepNumToRelGoals(rootGoal);
   let vars = $.goal.checkVarUsageAndReturnVars(rootGoal, logAttrs);
   let {
      plans,
      idxReg,
      subInfos,
      numPaths
   } = $.computeIncrementalUpdatePlan(rootGoal, logAttrs);

   let config0 = {
      attrs,
      vars,
      idxReg,
      plans
   };

   return {
      class: $.clsDerivedRelation,
      name: relname,
      attrs,
      logAttrs,
      isKeyed,
      indices: Array.from(potentialIndices, $.indexFromSpec),
      subInfos,
      config0,
      configs: {0: config0},
      numProjs,
      numPaths,
      numDeps,
      projections: $.makeProjectionRegistry(),
   };
}
clsDerivedProjection ::= ({
   name: 'projection.derived',
   'projection.derived': true,
   'projection': true,
})
makeProjection ::= function (rel, bindings) {
   let config = $.configFor(rel, bindings);
   let subProjs = $.refSubProjections(rel.subInfos, bindings);
   let subVers = new Array(rel.numProjs).fill(null);
   let subIndexInstances = Array.from(
      config.idxReg,
      ({projNum, index}) => $.refIndexInstance(subProjs[projNum], index)
   );

   let proj = {
      class: $.clsDerivedProjection,
      rel,
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      config: config,
      subProjs,
      subVers,
      subIndexInstances,
      myVer: null,
      records: null,  // dry in the beginning
      rkeyBound: $.hasOwnProperty(bindings, $.recKey) ? bindings[$.recKey] : undefined,
      rvalBound: $.hasOwnProperty(bindings, $.recVal) ? bindings[$.recVal] : undefined,
      // forward: rkey -> [subkey, subkey, ...]
      recDeps: new Map,
      // backward: [ {subkey -> Set{rkey, rkey, ...}}, ...], numDeps in length
      subrecDeps: $.produceArray(rel.numDeps, $.multimap),
      myIndexInstances: [],
   };

   $.rebuildProjection(proj);

   return proj;
}
refSubProjections ::= function (subInfos, bindings) {
   let subProjs = [];

   for (let {rel, firmBindings, looseBindings} of subInfos) {
      let subBindings = {...firmBindings};

      for (let [subAttr, attr] of $.ownEntries(looseBindings)) {
         if ($.hasOwnDefinedProperty(bindings, attr)) {
            subBindings[subAttr] = bindings[attr];
         }
      }

      let proj = $.projectionFor(rel, subBindings);
      proj.refCount += 1;
      subProjs.push(proj);
   }

   return subProjs;
}
freeProjection ::= function (proj) {
   for (let inst of proj.subIndexInstances) {
      $.releaseIndexInstance(inst);
   }

   for (let subVer of proj.subVers) {
      if (subVer !== null) {
         $.releaseVersion(subVer);
      }
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
configFor ::= function (rel, bindings) {
   let cfgkey = $.bindings2configKeys(rel.logAttrs, bindings);

   if (!$.hasOwnProperty(rel.configs, cfgkey)) {
      rel.configs[cfgkey] = $.narrowConfig(
         rel.config0, rel.subInfos, Reflect.ownKeys(bindings)
      );
   }
   
   return rel.configs[cfgkey];
}
bindings2configKeys ::= function (logAttrs, bindings) {
   let cfgkey = 0;

   for (let i = 0; i < logAttrs.length; i += 1) {
      if ($.hasOwnDefinedProperty(bindings, logAttrs[i])) {
         cfgkey |= (1 << i);
      }
   }

   return cfgkey;
}
rebuildProjection ::= function (proj) {
   $.check(proj.myVer === null, `Cannot rebuild projection which is being referred to`);

   let {rel, config, subProjs, subVers} = proj;

   for (let subProj of subProjs) {
      $.gUpdateProjection(subProj);
   }

   for (let num = 0; num < rel.numProjs; num += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the respective subproj, we
      // don't re-create the version object.
      let newVer = $.refCurrentState(subProjs[num]);
      if (subVers[num] !== null) {
         $.releaseVersion(subVers[num]);
      }
      subVers[num] = newVer;
   }

   proj.records = new ($.recordCollection(proj));

   let subKeys = new Array(rel.numDeps).fill(null);
   let ns = Object.fromEntries($.map(config.vars, lvar => [lvar, undefined]));

   // For recKey- and recVal-bound projections, we need those variables in the 'ns'
   // anyway to make records. So add them back explicitly.
   if (proj.rkeyBound !== undefined) {
      ns[$.recKey] = proj.rkeyBound;
   }

   if (proj.rvalBound !== undefined) {
      ns[$.recVal] = proj.rvalBound;
   }

   function run(jnode) {
      if (jnode === null) {
         let [rkey, rval] = $.makeRecordPairFor(proj, ns);

         proj.records.addPair(rkey, rval);
         $.recDep(proj, rkey, subKeys);

         for (let inst of proj.myIndexInstances) {
            $.indexAdd(inst, rkey, rval);
         }

         // No need to adjust myVer because it's null
         return;
      }
      
      if (jnode.class === $.clsJoinEither) {
         for (let branch of jnode.branches) {
            run(branch);
         }

         return;
      }

      if (jnode.class === $.clsJoinFunc) {
         throw new Error;

         for (let _ of $.joinFuncRel(proj, jnode, ns)) {
            run(jnode.next);
         }

         return;
      }

      let {toCheck, toExtract, rkeyExtract, rvalExtract, rvalCheck, projNum} = jnode;
      let subProj = subProjs[projNum];
      let depNum = rel.subInfos[projNum].depNum;

      outer:
      for (let [subkey, subval] of $.joinRecords(proj, jnode, ns)) {
         if (rvalCheck !== null && subval !== ns[rvalCheck]) {
            continue outer;
         }

         for (let [attr, lvar] of toCheck) {
            if (subval[attr] !== ns[lvar]) {
               continue outer;
            }
         }

         if (rkeyExtract !== null) {
            ns[rkeyExtract] = subkey;
         }

         if (rvalExtract !== null) {
            ns[rvalExtract] = subval;
         }

         for (let [attr, lvar] of toExtract) {
            ns[lvar] = subval[attr];
         }

         subKeys[depNum] = subkey;
         run(jnode.next);
         subKeys[depNum] = null;
      }
   }

   $.coverAllPaths(proj, (num) => {
      let {rkeyExtract, rvalExtract, start, joinTree} = config.plans[num];
      let subProj = subProjs[num];
      let {depNum} = rel.subInfos[num];
      
      for (let [subkey, subval] of $.projectionPairs(subProj)) {
         if (rkeyExtract !== null) {
            ns[rkeyExtract] = subkey;
         }

         if (rvalExtract !== null) {
            ns[rvalExtract] = subval;
         }

         for (let [attr, lvar] of start) {
            ns[lvar] = subval[attr];
         }

         subKeys[depNum] = subkey;
         run(joinTree);
         subKeys[depNum] = null;
      }
   });

   $.markProjectionValid(proj);
}
coverAllPaths ::= function (proj, callback) {
   let {subProjs, rel: {numPaths, subInfos}} = proj;

   // Greedy algorithm
   let subs = Array.from(subProjs);
   subs.sort((A, B) => $.projectionSizeEstimate(B) - $.projectionSizeEstimate(A));

   let paths = new Set($.range(numPaths));
   
   while (paths.size > 0) {
      let osize = paths.size;
      let pnum;

      while (paths.size === osize) {
         pnum = subProjs.indexOf(subs.pop());
         $.deleteAll(paths, subInfos[pnum].coveredPaths);
      }

      callback(pnum);
   }
}
updateProjection ::= function (proj) {
   if (proj.records === null) {
      // This is a 'dry' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   // Remove
   function removeForSubkeyRemoval(depNum, subkey) {
      let rkeys = $.subrecUndep(proj, depNum, subkey);

      for (let rkey of rkeys) {
         let rval = proj.records.valueAtX(rkey);

         proj.records.removeAt(rkey);

         if (proj.myVer !== null) {
            $.multiVersionRemoveKey(proj.myVer, rkey);
         }

         for (let inst of proj.myIndexInstances) {
            $.indexRemove(inst, rkey, rval);
         }
      }
   }

   let {rel, config} = proj;

   let addedNums = [];

   for (let num = 0; num < rel.numProjs; num += 1) {
      let ver = proj.subVers[num];
      let {depNum} = rel.subInfos[num];

      if ($.isVersionFresh(ver)) {
         continue;
      }

      $.unchainVersion(ver);

      for (let subkey of $.versionRemovedKeys(ver)) {
         removeForSubkeyRemoval(depNum, subkey);
      }

      if ($.hasVersionAdded(ver)) {
         addedNums.push(num);
      }
   }

   // Add
   let ns = Object.fromEntries($.map(config.vars, lvar => [lvar, undefined]));

   // For recKey- and recVal-bound projections, we need those variables in the 'ns'
   // anyway to make records. So add them back explicitly.
   if (proj.rkeyBound !== undefined) {
      ns[$.recKey] = proj.rkeyBound;
   }

   if (proj.rvalBound !== undefined) {
      ns[$.recVal] = proj.rvalBound;
   }

   let subKeys = new Array(rel.numDeps).fill(null);

   for (let dnum of addedNums) {
      let {rkeyExtract, rvalExtract, start, joinTree} = config.plans[dnum];
      let subProj = proj.subProjs[dnum];
      let ver = proj.subVers[dnum];
      let {depNum} = rel.subInfos[dnum];

      function run(jnode) {
         if (jnode === null) {
            let [rkey, rval] = $.makeRecordPairFor(proj, ns);

            proj.records.addPair(rkey, rval);
            $.recDep(proj, rkey, subKeys);

            for (let inst of proj.myIndexInstances) {
               $.indexAdd(inst, rkey, rval);
            }

            if (proj.myVer !== null) {
               $.multiVersionAddKey(proj.myVer, rkey);
            }

            return;
         }
         
         if (jnode.class === $.clsJoinEither) {
            for (let branch of jnode.branches) {
               run(branch);
            }

            return;
         }

         if (jnode.class === $.clsJoinFunc) {
            throw new Error;

            for (let _ of $.joinFuncRel(proj, jnode, ns)) {
               run(jnode.next);
            }

            return;
         }

         let {projNum, toCheck, toExtract, rkeyExtract, rvalCheck, rvalExtract} = jnode;
         let subProj = proj.subProjs[projNum];
         let {depNum} = rel.subInfos[projNum];

         let keysToExclude;

         if (projNum < dnum) {
            let ver = proj.subVers[projNum];

            keysToExclude = $.settify($.versionAddedKeys(ver));
         }
         else {
            keysToExclude = new Set;
         }

         outer:
         for (let [subkey, subval] of $.joinRecords(proj, jnode, ns)) {
            if (keysToExclude.has(subkey)) {
               continue;
            }

            if (rvalCheck !== null && ns[rvalCheck] !== subval) {
               continue outer;
            }

            for (let [attr, lvar] of jnode.toCheck) {
               if (subval[attr] !== ns[lvar]) {
                  continue outer;
               }
            }

            if (rkeyExtract !== null) {
               ns[rkeyExtract] = subkey;
            }

            if (rvalExtract !== null) {
               ns[rvalExtract] = subval;
            }

            for (let [attr, lvar] of toExtract) {
               ns[lvar] = subval[attr];
            }

            subKeys[depNum] = subkey;
            run(jnode.next);
            subKeys[depNum] = null;
         }
      }

      for (let subkey of $.versionAddedKeys(ver)) {
         let subval = $.projectionRvalAtX(subProj, subkey);

         if (rkeyExtract !== null) {
            ns[rkeyExtract] = subkey;
         }

         if (rvalExtract !== null) {
            ns[rvalExtract] = subval;
         }

         for (let [attr, lvar] of start) {
            ns[lvar] = subval[attr];
         }

         subKeys[depNum] = subkey;
         run(joinTree);
         subKeys[depNum] = null;
      }
   }

   // Finally ref new subversions
   for (let num = 0; num < rel.numProjs; num += 1) {
      let newVer = $.refCurrentState(proj.subProjs[num]);
      $.releaseVersion(proj.subVers[num]);
      proj.subVers[num] = newVer;
   }

   $.markProjectionValid(proj);
}
joinFuncRel ::= function (proj, jnode, ns) {
   throw new Error;

   let {run, args} = jnode;
   let array = [ns];

   for (let arg of args) {
      if ($.hasOwnProperty(arg, 'getValue')) {
         array.push(arg.getValue(proj.boundAttrs));
      }
      else {
         let {isBound, lvar} = arg;

         array.push(isBound ? ns[lvar] : lvar);
      }
   }
   
   return run.apply(null, array);
}
joinRecords ::= function (proj, jnode, ns) {
   let {class: cls, projNum} = jnode;
   let subProj = proj.subProjs[projNum];
   
   if (cls === $.clsJoinAll) {
      return $.projectionPairs(subProj);
   }

   if (cls === $.clsJoinRecKey) {
      let rkey = ns[jnode.rkeyVar]
      let rval = $.projectionRvalAt(subProj, rkey);
      return rval !== undefined ? [[rkey, rval]] : [];
   }

   if (cls === $.clsJoinIndex) {
      let {indexNum, indexKeys} = jnode;

      return $.indexRefPairs(
         proj.subIndexInstances[indexNum], $.map(indexKeys, lvar => ns[lvar])
      );
   }

   throw new Error(`Cannot handle this join type here: ${type}`);
}
makeRecordPairFor ::= function (proj, ns) {
   let {isKeyed, config} = proj;

   if (isKeyed) {
      if (config.attrs.length === 0) {
         return [ns[$.recKey], ns[$.recVal]];
      }
      else {
         return [
            ns[$.recKey],
            Object.fromEntries($.map(config.attrs, a => [a, ns[a]]))
         ];
      }
   }
   else {
      let rec = Object.fromEntries($.map(config.attrs, a => [a, ns[a]]))

      return [rec, rec];
   }
}
recDep ::= function (proj, rkey, subKeys) {
   subKeys = Array.from(subKeys);
   proj.recDeps.set(rkey, subKeys);

   for (let [mmap, subKey] of $.zip(proj.subrecDeps, subKeys)) {
      $.mmapAdd(mmap, subKey, rkey);
   }
}
subrecUndep ::= function (proj, depNum, subKey) {
   // We need to make a copy because this set is going to be modified inside the loop
   let rkeys = Array.from(proj.subrecDeps[depNum].get(subKey) ?? []);

   for (let rkey of rkeys) {
      $.recUndep(proj, rkey);
   }

   return rkeys;
}
recUndep ::= function (proj, rkey) {
   let subKeys = proj.recDeps.get(rkey);

   for (let [mmap, subKey] of $.zip(proj.subrecDeps, subKeys)) {
      if (subKey !== null) {
         $.mmapDelete(mmap, subKey, rkey);
      }
   }

   proj.recDeps.delete(rkey);
}
