common
   arraysEqual
   assert
   check
   commonArrayPrefixLength
   find
   isA
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
   noUndefinedProps
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
   intersect
dedb-rec-key
   recKey
   recVal
   normalizeAttrs
dedb-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeProjectionRegistry
dedb-goal
   * as: goal
   checkVarUsage
   initGoalTree
   makeLvar
dedb-scaffolding
   buildScaffolding
   computeSubBindingRoutes
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
   indexRefSize
dedb-join-plan
   clsJoinAll
   clsJoinIndex
   clsJoinRecKey
   clsJoinFunc
   clsJoinEither
   makeConfig
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
   let isUnwrapped = false;

   if (isKeyed) {
      if (attrs.length === 0) {
         logAttrs = [$.recKey, $.recVal];
         isUnwrapped = true;
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

      return $.makeLvar(name);
   }

   if (isKeyed) {
      Object.defineProperties(vTagged, {
         key: {
            get() {
               return $.makeLvar($.recKey)
            }
         },
         value: {
            get() {
               return $.makeLvar($.recVal)
            }
         }
      });
   }

   let rootGoal = bodyCallback(vTagged);

   if (rootGoal instanceof Array) {
      rootGoal = $.goal.and(...rootGoal);
   }
   
   $.checkVarUsage(rootGoal, logAttrs);

   let {
      numDeps,
      firmVarBindings,
      vars,
      nonEvaporatables
   } = $.initGoalTree(rootGoal, logAttrs);

   let {
      path2goals,
      goal2paths,
      var2ff,
      subGoals,
      subStateful,
   } = $.buildScaffolding(rootGoal);

   let subBindingRoutes = $.computeSubBindingRoutes(rootGoal, logAttrs);

   return {
      class: $.clsDerivedRelation,
      name: relname,
      attrs,
      logAttrs,
      isKeyed,
      isUnwrapped,
      indices: Array.from(potentialIndices, $.indexFromSpec),
      numDeps,
      numPaths: path2goals.size,
      firmVarBindings,
      vars,
      nonEvaporatables,
      path2goals,
      goal2paths,
      var2ff,
      subGoals,
      subStateful,
      subBindingRoutes,
      configs: new Map,  // cfgkey -> config object
      projections: $.makeProjectionRegistry(),
   };
}
clsDerivedProjection ::= ({
   name: 'projection.derived',
   'projection.derived': true,
   'projection': true,
})
makeProjection ::= function (rel, bindings) {
   bindings = $.noUndefinedProps(bindings);

   let config = $.configFor(rel, bindings);
   let subBindings = $.makeSubBindings(rel.subBindingRoutes, bindings);
   let subs = [];

   for (let [n, [subBindings1, {rel: subRel}]] of
         $.enumerate($.zip(subBindings, rel.subStateful))) {
      let subProj = $.projectionFor(subRel, subBindings1);

      subProj.refCount += 1;

      subs.push({
         num: n,
         proj: subProj,
         ver: null,
         owner: subRel.class === $.clsDerivedRelation ? subProj : subRel,
      })
   }

   let subIndexInstances = Array.from(
      config.idxReg,
      ({subNum, index}) => $.refIndexInstance(subs[subNum].owner, index)
   );

   let ns = new Object();

   for (let [lvar, val] of rel.firmVarBindings) {
      ns[lvar] = val;
   }

   for (let attr of config.nonEvaporated) {
      ns[attr] = bindings[attr];
   }

   for (let lvar of config.vars) {
      ns[lvar] = undefined;
   }

   let proj = {
      class: $.clsDerivedProjection,
      rel,
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      config: config,
      subs,
      subIndexInstances,
      myVer: null,
      records: null,  // dry in the beginning
      ns,
      // forward: rkey -> [subkey, subkey, ...]
      recDeps: new Map,
      // backward: [ {subkey -> Set{rkey, rkey, ...}}, ...], numDeps in length
      subrecDeps: $.produceArray(rel.numDeps, $.multimap),
      myIndexInstances: [],
   };

   $.rebuildProjection(proj);

   return proj;
}
makeSubBindings ::= function (subBindingRoutes, bindings) {
   let {firms, routes} = subBindingRoutes;

   // firms :: [Map{attr -> value}], becomes :: [{attr: value}]
   firms = Array.from(firms, firm => Object.fromEntries(firm));

   for (let [attr, val] of $.ownEntries(bindings)) {
      for (let [subNum, subAttr] of routes.get(attr) ?? []) {
         firms[subNum][subAttr] = val;
      }
   }

   return firms;
}
freeProjection ::= function (proj) {
   for (let inst of proj.subIndexInstances) {
      $.releaseIndexInstance(inst);
   }

   for (let {ver: subVer} of proj.subs) {
      if (subVer !== null) {
         $.releaseVersion(subVer);
      }
   }

   for (let {proj: subProj} of proj.subs) {
      subProj.validRevDeps.delete(proj);
      $.releaseProjection(subProj);
   }
}
markProjectionValid ::= function (proj) {
   for (let {proj: subProj} of proj.subs) {
      subProj.validRevDeps.add(proj);
   }

   proj.isValid = true;
}
configFor ::= function (rel, bindings) {
   let {configs, logAttrs} = rel;
   let cfgkey = $.bindings2cfgkey(logAttrs, bindings);

   if (!configs.has(cfgkey)) {
      configs.set(cfgkey, $.makeConfig(rel, Reflect.ownKeys(bindings)));
   }
   
   return configs.get(cfgkey);
}
bindings2cfgkey ::= function (logAttrs, bindings) {
   let cfgkey = 0;

   for (let i = 0; i < logAttrs.length; i += 1) {
      if ($.hasOwnProperty(bindings, logAttrs[i])) {
         cfgkey |= (1 << i);
      }
   }

   return cfgkey;
}
withNsObjectCleanup ::= function (proj, callback) {
   try {
      return callback();
   }
   finally {
      let {ns, config: {vars}} = proj;

      for (let lvar of vars) {
         ns[lvar] = undefined;
      }
   }
}
rebuildProjection ::= function (proj) {
   $.check(proj.myVer === null, `Cannot rebuild projection which is being referred to`);

   let {rel, config, ns} = proj;

   for (let {proj: subProj} of proj.subs) {
      $.gUpdateProjection(subProj);
   }

   for (let sub of proj.subs) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the respective subproj, we
      // don't re-create the version object.
      let newVer = $.refCurrentState(sub.proj);
      if (sub.ver !== null) {
         $.releaseVersion(sub.ver);
      }
      sub.ver = newVer;
   }

   proj.records = new ($.recordCollection(proj))();

   let subkeys = new Array(rel.numDeps).fill(null);

   function join(jnode) {
      if (jnode === null) {
         let [rkey, rval] = $.makeNewRecord(proj);

         proj.records.addPair(rkey, rval);
         $.recDep(proj, rkey, subkeys);

         for (let inst of proj.myIndexInstances) {
            $.indexAdd(inst, rkey, rval);
         }

         // No need to adjust myVer because it's null
         return;
      }
      
      if (jnode.class === $.clsJoinEither) {
         for (let branch of jnode.branches) {
            join(branch);
         }

         return;
      }

      if (jnode.class === $.clsJoinFunc) {
         throw new Error;

         for (let _ of $.joinFuncRel(proj, jnode, ns)) {
            join(jnode.next);
         }

         return;
      }

      let {toCheck, toExtract, rkeyExtract, rvalExtract, rvalCheck, subNum} = jnode;
      let {proj: subProj} = proj.subs[subNum];
      let {depNum} = rel.subStateful[subNum];

      outer:
      for (let [subkey, subval] of $.joinRecords(proj, jnode)) {
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

         subkeys[depNum] = subkey;
         join(jnode.next);
         subkeys[depNum] = null;
      }
   }

   $.withNsObjectCleanup(
      proj,
      () => $.coverAllPaths(proj, subNum => join(config.plans[subNum]))
   );

   $.markProjectionValid(proj);
}
coverAllPaths ::= function (proj, callback) {
   let {rel: {numPaths, subStateful}, config} = proj;

   // Greedy algorithm
   let subs = Array.from(proj.subs);

   subs.sort((A, B) => {
      let capA = $.jnodeCapacity(proj, config.plans[A.num]);
      let capB = $.jnodeCapacity(proj, config.plans[B.num]);

      return capB - capA;
   });

   let paths = new Set($.range(numPaths));

   while (paths.size > 0) {
      let osize = paths.size;
      let subNum;

      while (paths.size === osize) {
         subNum = subs.pop().num;
         $.deleteAll(paths, subStateful[subNum].coveredPaths);
      }

      callback(subNum);
   }
}
jnodeCapacity ::= function (proj, jnode) {
   let {class: cls} = jnode;

   if (cls === $.clsJoinRecKey) {
      return 1;
   }

   if (cls === $.clsJoinAll) {
      let {owner} = proj.subs[jnode.subNum];

      return owner.records.size;
   }

   if (cls === $.clsJoinIndex) {
      let {indexNum, indexKeys} = jnode;
      let inst = proj.subIndexInstances[indexNum];

      return $.indexRefSize(inst, $.map(indexKeys, lvar => proj.ns[lvar]));
   }

   throw new Error;
}
updateProjection ::= function (proj) {
   if (proj.records === null) {
      // This is a 'dry' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let {proj: subProj} of proj.subs) {
      $.gUpdateProjection(subProj);
   }

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

   function updateVersions() {
      for (let sub of proj.subs) {
         let newVer = $.refCurrentState(sub.proj);
         $.releaseVersion(sub.ver);
         sub.ver = newVer;
      }
   }

   let {rel, config} = proj;
   
   // Step 0: remove what needs to be removed & collect sub numvers that have added recs
   let addedSubs = [];

   for (let sub of proj.subs) {
      if ($.isVersionFresh(sub.ver)) {
         continue;
      }

      $.unchainVersion(sub.ver);

      let {depNum} = rel.subStateful[sub.num];

      for (let subkey of $.versionRemovedKeys(sub.ver)) {
         removeForSubkeyRemoval(depNum, subkey);
      }

      if ($.hasVersionAdded(sub.ver)) {
         addedSubs.push(sub);
      }
   }

   // Step 1: if nothing added, we're done
   if (addedSubs.length === 0) {
      updateVersions();
      $.markProjectionValid(proj);

      return;
   }

   // Step 2: create new records by running the machinery
   let {ns} = proj;

   function join(Dnum, Dpairs) {
      return (function rec(jnode, Dpairs=null) {
         if (jnode === null) {
            let [rkey, rval] = $.makeNewRecord(proj);

            proj.records.addPair(rkey, rval);
            $.recDep(proj, rkey, subkeys);

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
               rec(branch);
            }

            return;
         }

         if (jnode.class === $.clsJoinFunc) {
            throw new Error;

            for (let _ of $.joinFuncRel(proj, jnode, ns)) {
               rec(jnode.next);
            }

            return;
         }

         let {subNum, toCheck, toExtract, rkeyExtract, rvalCheck, rvalExtract} = jnode;
         let {depNum} = rel.subStateful[subNum];

         let keysToExclude;

         if (subNum < Dnum) {
            let {ver} = proj.subs[subNum];

            keysToExclude = $.settify($.versionAddedKeys(ver));
         }
         else {
            keysToExclude = new Set;
         }

         outer:
         for (let [subkey, subval] of Dpairs ?? $.joinRecords(proj, jnode)) {
            if (keysToExclude.has(subkey)) {
               continue;
            }

            if (rvalCheck !== null && ns[rvalCheck] !== subval) {
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

            subkeys[depNum] = subkey;
            rec(jnode.next);
            subkeys[depNum] = null;
         }
      })(config.plans[Dnum], Dpairs);
   }

   let subkeys = new Array(rel.numDeps).fill(null);
   
   $.withNsObjectCleanup(proj, () => {
      for (let sub of addedSubs) {
         let {ver, num, owner: subOwner} = sub;

         join(num, $.map(
            $.versionAddedKeys(ver),
            subkey => [subkey, subOwner.records.valueAtX(subkey)]
         ));
      }
   });

   updateVersions();
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
joinRecords ::= function (proj, jnode) {
   let {class: cls, subNum} = jnode;
   let {owner: subOwner} = proj.subs[subNum];
   let {ns} = proj;

   if (cls === $.clsJoinAll) {
      // $.assert(() => subOwner.class === $.clsDerivedProjection);

      return subOwner.records.pairs();
   }

   if (cls === $.clsJoinRecKey) {
      let rkey = ns[jnode.rkeyVar];
      let rval = subOwner.records.valueAt(rkey);

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
makeNewRecord ::= function (proj) {
   let {rel: {isKeyed, isUnwrapped}, config, ns} = proj;

   if (isUnwrapped) {
      return [ns[$.recKey], ns[$.recVal]];
   }
   else if (isKeyed) {
      return [
         ns[$.recKey],
         Object.fromEntries($.map(config.attrs, a => [a, ns[a]]))
      ];
   }
   else {
      let rec = Object.fromEntries($.map(config.attrs, a => [a, ns[a]]))

      return [rec, rec];
   }
}
recDep ::= function (proj, rkey, subkeys) {
   subkeys = Array.from(subkeys);
   proj.recDeps.set(rkey, subkeys);

   for (let [mmap, subkey] of $.zip(proj.subrecDeps, subkeys)) {
      $.mmapAdd(mmap, subkey, rkey);
   }
}
subrecUndep ::= function (proj, depNum, subkey) {
   // We need to make a copy because this set is going to be modified inside the loop
   let rkeys = Array.from(proj.subrecDeps[depNum].get(subkey) ?? []);

   for (let rkey of rkeys) {
      $.recUndep(proj, rkey);
   }

   return rkeys;
}
recUndep ::= function (proj, rkey) {
   let subkeys = proj.recDeps.get(rkey);

   for (let [mmap, subkey] of $.zip(proj.subrecDeps, subkeys)) {
      if (subkey !== null) {
         $.mmapDelete(mmap, subkey, rkey);
      }
   }

   proj.recDeps.delete(rkey);
}
