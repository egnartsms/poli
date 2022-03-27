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
   releaseProjection
   updateProjection as: updateGenericProjection
   makeProjectionRegistry
dedb-goal
   makeLvar
   buildGoalTree
dedb-version
   refCurrentState
   releaseVersion
   isVersionPristine
   unchainVersion
   multiVersionAddKey
   multiVersionRemoveKey
   makeZeroVersion
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
   rkeyX2pairFn
dedb-owner
   ownerSize
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
      root,
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
      root,
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
            return $.refDerivedInstance(subProj, desired);
         }
         else {
            return $.refBaseInstance(subProj.rel, desired);
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
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      dataHolder: null,  // will be set to the projection itself
      config,
      subs,
      subIndexInstances,
      records: new $.RecDependencies(rel.numDeps, rel.isKeyed),
      ns,
      myVer: null,
      myIndexInstances: new Set,
   };

   proj.dataHolder = proj;

   $.rebuildProjection(proj);

   return proj;
}
makeSubBindings ::= function (firms, subRoutes, bindings) {
   // firms :: [Map{attr -> value}], subBindings :: [{attr: value}]
   let subBindings = Array.from(firms, Object.fromEntries);

   for (let [attr, val] of $.ownEntries(bindings)) {
      for (let [subNum, subAttr] of routes.get(attr) ?? []) {
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
jnodeCapacity ::= function (proj, jnode) {
   let {class: cls} = jnode;

   if (cls === $.clsJoinRecKey) {
      return 1;
   }

   if (cls === $.clsJoinAll) {
      let {owner} = proj.subs[jnode.subNum];

      return $.ownerSize(owner);
   }

   if (cls === $.clsJoinIndex) {
      let {indexNum, indexKeys} = jnode;
      let inst = proj.subIndexInstances[indexNum];

      return $.indexRefSize(inst, $.map(indexKeys, lvar => proj.ns[lvar]));
   }

   throw new Error;
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

               solutions.push({
                  subs: [sub],
                  rs: sub.proj.referentialSize
               })         
            }),

            ...$.map(group.choices, choiceRS)
         ];

         let [{subs: bestSubs}, minRS] = $.leastBy(solutions, sol => sol.rs);

         return {
            subs: bestSubs,
            rs: min
         }
      }

      function choiceRS(choice) {
         let solutions = Array.from(choice.alts, groupRS);

         return {
            subs: Array.from($.chain($.map(solutions, sol => sol.subs))),
            rs: solutions.reduce((sum, sol) => sum + sol.rs)
         }
      }

      return groupRS(proj.rel.root);
   })();

   let {config} = proj;

   proj.records.clear();

   $.withNsObjectCleanup(() => {
      for (let sub of subs) {
         $.run(proj, config.joinSpecs[sub.num], $.projectionPairs(sub.proj), 0);
      }
   });

   for (let sub of proj.subs) {
      let newVer = $.refCurrentState(sub.proj);
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

      for (let subkey of $.versionRemovedKeys(sub.ver)) {
         let pairs = proj.records.removeDependency(sub.goal.depNum, subkey);

         if (proj.myVer !== null) {
            for (let [rkey] of pairs) {
               $.multiVersionRemoveKey(proj.myVer, rkey);
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
         if ($.isVersionPristine(sub.ver)) {
            continue;
         }

         $.run(proj, config.joinSpecs[sub.num], $.projectionPairs(sub.proj), sub.num);
      }
   });

   for (let sub of proj.subs) {
      let newVer = $.refCurrentState(sub.proj);
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
            $.multiVersionAddKey(proj.myVer, rkey);
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
      let {depNum} = rel.statefulGoals[subNum];

      let keysToExclude = null;

      if (subNum < Lnum) {
         let {ver} = proj.subs[subNum];

         keysToExclude = $.settify($.versionAddedKeys(ver));
      }

      outer:
      for (let [subkey, subval] of $.joinRecords(proj, jnode)) {
         if (keysToExclude !== null && keysToExclude.has(subkey)) {
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

   for (let [rkey, rval] of pairs0) {
      for (let [attr, lvar] of spec.toExtract) {
         ns[lvar] = rval[attr];
      }

      subkeys[spec.depNum] = rkey;
      rec(spec.jroot);
      subkeys[spec.depNum] = null;
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
      return subProj.dataHolder.records.pairs();
   }

   if (kind === 'rec-key') {
      let rkey = ns[jnode.rkeyVar];
      
      if (subProj.dataHolder.records.hasAt(rkey)) {
         return [[rkey, subProj.dataHolder.records.valueAtX(rkey)]];
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
