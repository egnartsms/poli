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
   leastBy
data-structures
   RecDependencies
set-map
   deleteAll
   intersect
dedb-rec-key
   recKey
   recVal
   normalizeAttrs
dedb-projection
   projectionFor
   projectionPairs
   referentialSize
   releaseProjection
   updateProjection as: updateGenericProjection
   makeProjectionRegistry
dedb-goal
   makeLvar
   buildGoalTree
dedb-version
   hasVersionAdded
   refProjectionState
   releaseVersion
   isVersionPristine
   prepareVersion
   versionAddPair
   versionRemovePair
   versionAddedPairs
   versionRemovedPairs
   versionAddedKeyCont
dedb-index
   copyIndex
   indexFromSpec
dedb-index-instance
   refBaseInstance
   refDerivedInstance
   releaseIndexInstance
   indexAdd
   indexRemove
   indexRefPairs
   indexRefSize
dedb-join-plan
   makeConfig
dedb-relation
   rkeyX2pairFn
-----
MAX_REL_ATTRS ::= 30
derivedRelation ::= function ({
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

   let root0 = bodyCallback($.taggedVarProducer);

   let {
      rootGroup,
      goals,
      statefulGoals,
      numDeps,
      firmVarBindings,
      fictitiousVars,
      firms,
      subRoutes,
      vars,
      varsNE
   } = $.buildGoalTree(root0, logAttrs);

   return {
      kind: 'derived',
      name: relname,
      attrs,
      logAttrs,
      isKeyed,
      isUnwrapped,
      indices: Array.from(potentialIndices, $.indexFromSpec),
      rootGroup,
      goals,
      statefulGoals,
      numDeps,
      firmVarBindings,
      fictitiousVars,
      firms,
      subRoutes,
      vars,
      varsNE,      
      configs: new Map,  // cfgkey -> config object
      projections: $.makeProjectionRegistry(),
   };
}
taggedVarProducer ::= (function () {
   function vTagged(strings) {
      if (strings.length !== 1) {
         throw new Error(`Variable names don't support inline expressions`);
      }

      let [name] = strings;

      return $.makeLvar(name);
   }

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

   return vTagged;
})()
makeProjection ::= function (rel, bindings) {
   bindings = $.noUndefinedProps(bindings);

   let config = $.configFor(rel, bindings);
   let subs = [];

   for (let [num, [subBinding, goal]] of
         $.enumerate(
            $.zip(
               $.makeSubBindings(rel.firms, rel.subRoutes, bindings),
               rel.statefulGoals
            )
         )) {
      let subProj = $.projectionFor(goal.rel, subBinding);

      subProj.refCount += 1;

      subs.push({
         num,
         proj: subProj,
         ver: null,
         goal
      })
   }

   let subIndexInstances = Array.from(
      config.idxReg,
      ({subNum, index}) => {
         let {proj: subProj} = subs[subNum];

         if (subProj.kind === 'derived') {
            return $.refDerivedInstance(subProj, index);
         }
         else {
            return $.refBaseInstance(subProj.rel, index);
         }
      }
   );

   let ns = Object.create(null);

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
      kind: 'derived',
      rel,
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      config,
      subs,
      subIndexInstances,
      records: new $.RecDependencies(rel.numDeps, rel.isKeyed),
      fullRecords: null,  // will be set to the same object as .records
      ns,
      myVer: null,
      myIndexInstances: new Set,
   };

   proj.fullRecords = proj.records;

   $.rebuildProjection(proj);

   return proj;
}
makeSubBindings ::= function (firms, subRoutes, bindings) {
   // firms :: [Map{attr -> value}], subBindings :: [{attr: value}]
   let subBindings = Array.from(firms, Object.fromEntries);

   for (let [attr, val] of $.ownEntries(bindings)) {
      for (let [subNum, subAttr] of subRoutes.get(attr) ?? []) {
         subBindings[subNum][subAttr] = val;
      }
   }

   return subBindings;
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
freeProjection ::= function (proj) {
   $.check(proj.myIndexInstances.size === 0);

   for (let inst of proj.subIndexInstances) {
      $.releaseIndexInstance(inst);
   }

   for (let {ver: subVer} of proj.subs) {
      $.releaseVersion(subVer);
   }

   for (let {proj: subProj} of proj.subs) {
      subProj.validRevDeps.delete(proj);
      $.releaseProjection(subProj);
   }
}
markAsValid ::= function (proj) {
   for (let sub of proj.subs) {
      sub.proj.validRevDeps.add(proj);
   }

   proj.isValid = true;
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
   for (let {proj: subProj} of proj.subs) {
      $.updateGenericProjection(subProj);
   }

   let {subs} = (() => {
      let goal2sub = new Map($.map(proj.subs, sub => [sub.goal, sub]));

      function groupRS(group) {
         let solutions = [
            ...$.map(group.leaves, goal => {
               let sub = goal2sub.get(goal);

               return {
                  subs: [sub],
                  rs: $.referentialSize(sub.proj)
               }
            }),

            ...$.map(group.choices, choiceRS)
         ];

         let [{subs: bestSubs}, minRS] = $.leastBy(solutions, sol => sol.rs);

         return {
            subs: bestSubs,
            rs: minRS
         }
      }

      function choiceRS(choice) {
         let solutions = Array.from(choice.alts, groupRS);

         return {
            subs: Array.from($.chain($.map(solutions, sol => sol.subs))),
            rs: solutions.reduce((sum, sol) => sum + sol.rs)
         }
      }

      return groupRS(proj.rel.rootGroup);
   })();

   let {config} = proj;

   proj.records.clear();

   $.withNsObjectCleanup(proj, () => {
      for (let sub of subs) {
         $.run(proj, config.joinSpecs[sub.num], $.projectionPairs(sub.proj), 0);
      }
   });

   for (let sub of proj.subs) {
      let newVer = $.refProjectionState(sub.proj);
      if (sub.ver !== null) {
         $.releaseVersion(sub.ver);
      }
      sub.ver = newVer;
   }

   $.markAsValid(proj);
}
updateProjection ::= function (proj) {
   for (let sub of proj.subs) {
      $.updateGenericProjection(sub.proj);
   }

   // Removal
   for (let sub of proj.subs) {
      $.prepareVersion(sub.ver);

      for (let [subkey] of $.versionRemovedPairs(sub.ver)) {
         let pairs = proj.records.removeDependency(sub.goal.depNum, subkey);

         if (proj.myVer !== null) {
            for (let [rkey, rval] of pairs) {
               $.versionRemovePair(proj.myVer, rkey, rval);
            }
         }

         for (let inst of proj.myIndexInstances) {
            for (let [rkey, rval] of pairs) {
               $.indexRemove(inst, rkey, rval);
            }
         }
      }
   }

   // Adding
   let {config} = proj;

   $.withNsObjectCleanup(proj, () => {
      for (let sub of proj.subs) {
         if (!$.hasVersionAdded(sub.ver)) {
            continue;
         }

         $.run(proj, config.joinSpecs[sub.num], $.versionAddedPairs(sub.ver), sub.num);
      }
   });

   for (let sub of proj.subs) {
      let newVer = $.refProjectionState(sub.proj);
      $.releaseVersion(sub.ver);
      sub.ver = newVer;
   }

   $.markAsValid(proj);
}
run ::= function (proj, spec, pairs0, Lnum) {
   function rec(jnode) {
      if (jnode === null) {
         let [rkey, rval] = $.makeNewRecord(proj);

         proj.records.addDependency(rkey, subkeys, rval);

         for (let inst of proj.myIndexInstances) {
            $.indexAdd(inst, rkey, rval);
         }

         if (proj.myVer !== null) {
            $.versionAddPair(proj.myVer, rkey, rval);
         }

         return;
      }
      
      if (jnode.kind === 'either') {
         for (let branch of jnode.branches) {
            rec(branch);
         }

         return;
      }

      if (jnode.kind === 'func') {
         for (let _ of $.joinFunc(proj, jnode)) {
            rec(jnode.next);
         }

         return;
      }

      let {subNum, toCheck, toExtract, rkeyExtract, rvalCheck, rvalExtract} = jnode;
      let {depNum} = proj.rel.statefulGoals[subNum];

      let keysToExclude;

      if (subNum < Lnum) {
         let {ver} = proj.subs[subNum];

         keysToExclude = $.versionAddedKeyCont(ver);
      }
      else {
         keysToExclude = new Set;
      }

      outer:
      for (let [subkey, subval] of $.joinRecords(proj, jnode)) {
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
   }

   let subkeys = new Array(proj.rel.numDeps).fill(null);   
   let {ns} = proj;
   let {jroot, depNum, rkeyExtract, rvalExtract, toExtract} = spec;

   for (let [rkey, rval] of pairs0) {
      if (rkeyExtract !== null) {
         ns[rkeyExtract] = rkey;
      }
      if (rvalExtract !== null) {
         ns[rvalExtract] = rval;
      }

      for (let [attr, lvar] of toExtract) {
         ns[lvar] = rval[attr];
      }

      subkeys[depNum] = rkey;
      rec(jroot);
      subkeys[depNum] = null;
   }
}
joinFunc ::= function* (proj, jnode) {
   let {ns} = proj;
   let {run, args, toCheck} = jnode;

   outer:
   for (let _ of run(ns, ...args)) {
      for (let [v1, v2] of toCheck) {
         if (ns[v1] !== ns[v2]) {
            continue outer;
         }
      }

      yield;
   }
}
joinRecords ::= function (proj, jnode) {
   let {kind, subNum} = jnode;
   let {proj: subProj} = proj.subs[subNum];
   let {ns} = proj;

   if (kind === 'all') {
      return subProj.fullRecords.pairs();
   }

   if (kind === 'rec-key') {
      let rkey = ns[jnode.rkeyVar];
      
      if (subProj.fullRecords.hasAt(rkey)) {
         return [[rkey, subProj.fullRecords.valueAtX(rkey)]];
      }
      else {
         return [];
      }
   }

   if (kind === 'index') {
      let {indexNum, indexKeys} = jnode;

      return $.indexRefPairs(
         proj.subIndexInstances[indexNum], Array.from(indexKeys, lvar => ns[lvar])
      );
   }

   throw new Error;
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
