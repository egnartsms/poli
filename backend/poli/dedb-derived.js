common
   arraysEqual
   assert
   chain
   check
   commonArrayPrefixLength
   concat
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
   projectionRecords
   referentialSize
   releaseProjection
   updateProjection as: updateGenericProjection
   makeProjectionRegistry

dedb-goal
   makeLvar
   buildGoalTree

dedb-version
   refProjectionState
   releaseVersion
   prepareVersion
   versionAdd
   versionRemove
   versionAddedRecords
   versionRemovedRecords

dedb-index
   copyIndex
   tupleFromSpec
   reduceIndex

dedb-index-instance
   refBaseInstance
   refDerivedInstance
   releaseIndexInstance
   indexAdd
   indexRemove
   indexRef
   indexRefSize
   makeIndexInstance

dedb-join-plan
   makeConfig

dedb-relation
   rkeyX2pairFn

-----

MAX_REL_ATTRS ::= 30


derivedRelation ::=
   function ({
      name: relname,
      attrs,
      indices: indexSpecs = [],
      body: bodyCallback
   }) {
      $.check(attrs.length <= $.MAX_REL_ATTRS, `Too many attributes`);

      let root0 = bodyCallback($.vTagged);

      let {
         rootGroup,
         goals,
         statefulGoals,
         numDeps,
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         attrsNE
      } = $.buildGoalTree(root0, attrs);

      return {
         kind: 'derived',
         name: relname,
         attrs,
         indices: Array.from(potentialIndices, $.tupleFromSpec),
         hardIndices: Array.from(hardIndices, $.tupleFromSpec),
         rootGroup,
         goals,
         statefulGoals,
         numDeps,
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         attrsNE,
         configs: new Map,  // cfgkey -> config object
         projections: new Map,
      };
   }


vTagged ::=
   function (strings) {
      if (strings.length !== 1) {
         throw new Error(`Variable names don't support inline expressions`);
      }

      let [name] = strings;

      return $.makeLvar(name);
   }


computeIndices ::=
   function () {

   }


makeProjection ::=
   function (rel, bindings) {
      bindings = $.noUndefinedProps(bindings);

      let subs = [];

      for (let [num, [subBinding, goal]] of
            $.enumerate($.zip($.makeSubBindings(rel, bindings), rel.statefulGoals))) {
         let subProj = $.projectionFor(goal.rel, subBinding);

         subProj.refCount += 1;

         subs.push({
            num,
            proj: subProj,
            ver: null,
            goal
         })
      }

      let config = $.configFor(rel, bindings);

      let subInsts = Array.from(
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
         refCount: 0,
         regPoint: null,   // initialized by the calling code
         isValid: false,
         validRevDeps: new Set,
         config,
         subs,
         subInsts,
         records: new $.RecDependencies(rel.numDeps),
         fullRecords: null,  // will be set to the same object as .records
         // 'ns' and 'subRecs' are data structures needed to carry out the job of updating.
         // It's possible to just create them on each update
         ns,
         subrecs: new Array(rel.numDeps).fill(null),
         myVer: null,
         myInsts: [],
      };

      proj.fullRecords = proj.records;

      for (let index of rel.hardIndices) {
         index = $.reduceIndex(index, a => $.hasOwnProperty(bindings, a));

         if (index.length > 0) {
            let inst = $.makeIndexInstance(proj, index);
            inst.refCount += 1;
            proj.myInsts.push(inst);
         }
      }

      proj.myInsts.pastHardIndex = proj.myInsts.length;

      $.rebuildProjection(proj);

      return proj;
   }


makeSubBindings ::=
   function (rel, bindings) {
      let subBindings = Array.from(rel.statefulGoals, goal => ({...goal.firm}));

      for (let [attr, val] of Object.entries(bindings)) {
         for (let [subNum, subAttr] of rel.subRoutes.get(attr) ?? []) {
            subBindings[subNum][subAttr] = val;
         }
      }

      return subBindings;
   }


configFor ::=
   function (rel, bindings) {
      let {configs, attrs} = rel;
      let cfgkey = $.bindings2cfgkey(attrs, bindings);

      if (!configs.has(cfgkey)) {
         configs.set(cfgkey, $.makeConfig(rel, Reflect.ownKeys(bindings)));
      }
      
      return configs.get(cfgkey);
   }


bindings2cfgkey ::=
   function (attrs, bindings) {
      let cfgkey = 0;

      for (let i = 0; i < attrs.length; i += 1) {
         if (Object.hasOwn(bindings, attrs[i])) {
            cfgkey |= (1 << i);
         }
      }

      return cfgkey;
   }


freeProjection ::=
   function (proj) {
      $.check(proj.myInsts.length === proj.myInsts.pastHardIndex);

      for (let inst of proj.subInsts) {
         $.releaseIndexInstance(inst);
      }

      for (let sub of proj.subs) {
         $.releaseVersion(sub.ver);
      }

      for (let sub of proj.subs) {
         sub.proj.validRevDeps.delete(proj);
         $.releaseProjection(sub.proj);
      }
   }

validateProjection ::=
   function (proj) {
      for (let sub of proj.subs) {
         sub.proj.validRevDeps.add(proj);
      }

      proj.isValid = true;
   }

withNsObjectCleanup ::=
   function (proj, callback) {
      try {
         return callback();
      }
      finally {
         let {ns, config: {vars}, subrecs} = proj;

         for (let lvar of vars) {
            ns[lvar] = undefined;
         }

         subrecs.fill(null);
      }
   }

rebuildProjection ::=
   function (proj) {
      $.check(proj.myVer === null, `Cannot rebuild projection which is being referred to`);

      for (let sub of proj.subs) {
         $.updateGenericProjection(sub.proj);
      }

      let {subs} = (() => {
         let goal2sub = new Map($.map(proj.subs, sub => [sub.goal, sub]));

         function groupRS(group) {
            let solutions = [
               ...$.mapfilter(group.leaves, goal => {
                  if (!goal.isStateful) {
                     return;
                  }

                  let sub = goal2sub.get(goal);

                  return {
                     subs: [sub],
                     rs: $.referentialSize(sub.proj)
                  }
               }),

               ...$.map(group.choices, choiceRS)
            ];

            if (solutions.length === 0) {
               return {
                  subs: [],
                  minRS: Infinity
               }
            }

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
            $.run(proj, config.joinSpecs[sub.num], $.projectionRecords(sub.proj), 0);
         }
      });

      for (let sub of proj.subs) {
         let newVer = $.refProjectionState(sub.proj);
         if (sub.ver !== null) {
            $.releaseVersion(sub.ver);
         }
         sub.ver = newVer;
      }

      $.validateProjection(proj);
   }

updateProjection ::=
   function (proj) {
      for (let sub of proj.subs) {
         $.updateGenericProjection(sub.proj);
      }

      // Removal
      for (let sub of proj.subs) {
         $.prepareVersion(sub.ver);

         for (let subrec of $.versionRemovedRecords(sub.ver)) {
            let recs = proj.records.removeSub(sub.goal.depNum, subrec);

            if (proj.myVer !== null) {
               $.versionRemoveAll(proj.myVer, recs);
            }

            for (let inst of proj.myInsts) {
               $.indexRemoveAll(inst, recs);
            }
         }
      }

      // Adding
      let {config} = proj;

      $.withNsObjectCleanup(proj, () => {
         for (let sub of proj.subs) {
            $.run(
               proj, config.joinSpecs[sub.num], $.versionAddedRecords(sub.ver), sub.num
            );
         }
      });

      for (let sub of proj.subs) {
         let newVer = $.refProjectionState(sub.proj);
         $.releaseVersion(sub.ver);
         sub.ver = newVer;
      }

      $.validateProjection(proj);
   }

run ::=
   function (proj, spec, recs0, Lnum) {
      function join(jnode) {
         if (jnode === null) {
            let rec = $.makeNewRecord(proj);

            proj.records.add(rec, subrecs);

            for (let inst of proj.myInsts) {
               $.indexAdd(inst, rec);
            }

            if (proj.myVer !== null) {
               $.versionAdd(proj.myVer, rec);
            }

            return;
         }
         
         if (jnode.kind === 'either') {
            for (let branch of jnode.branches) {
               join(branch);
            }

            return;
         }

         if (jnode.kind === 'func') {
            for (let dumb of $.joinFunc(proj, jnode)) {
               join(jnode.next);
            }

            return;
         }

         let {subNum, toCheck, toExtract} = jnode;
         let {depNum} = proj.rel.statefulGoals[subNum];

         let toExclude;

         if (subNum < Lnum) {
            toExclude = exclusion.get(subNum);

            if (toExclude === undefined) {
               let {ver} = proj.subs[subNum];

               toExclude = $.settify($.versionAddedRecords(ver));
               exclusion.set(subNum, toExclude);
            }
         }
         else {
            toExclude = new Set;
         }

         outer:
         for (let subrec of $.joinRecords(proj, jnode)) {
            if (toExclude.has(subrec)) {
               continue;
            }

            for (let [attr, lvar] of toCheck) {
               if (subrec[attr] !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let [attr, lvar] of toExtract) {
               ns[lvar] = subrec[attr];
            }

            subrecs[depNum] = subrec;
            join(jnode.next);
            subrecs[depNum] = null;
         }
      }

      let exclusion = new Map;  // subNum -> Set{rec, ...}
      let {ns, subrecs} = proj;
      let {jroot, depNum, toExtract} = spec;

      for (let rec of recs0) {
         for (let [attr, lvar] of toExtract) {
            ns[lvar] = rec[attr];
         }

         subrecs[depNum] = rec;
         join(jroot);
         subrecs[depNum] = null;
      }
   }

joinFunc ::=
   function* (proj, jnode) {
      let {ns} = proj;
      let {run, args, toCheck} = jnode;

      outer:
      for (let dumb of run(ns, ...args)) {
         for (let [v1, v2] of toCheck) {
            if (ns[v1] !== ns[v2]) {
               continue outer;
            }
         }

         yield dumb;
      }
   }

joinRecords ::=
   function (proj, jnode) {
      let {kind, subNum} = jnode;
      let {proj: subProj} = proj.subs[subNum];
      let {ns} = proj;

      if (kind === 'all') {
         $.assert(() => subProj.rel.isDerived);

         return subProj.records;
      }

      if (kind === 'index') {
         let {indexNum, indexKeys} = jnode;

         return $.indexRef(
            proj.subInsts[indexNum], Array.from(indexKeys, lvar => ns[lvar])
         );
      }

      throw new Error;
   }

makeNewRecord ::=
   function (proj) {
      return Object.fromEntries($.map(proj.config.attrs, a => [a, proj.ns[a]]))
   }
