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
   * as: version

dedb-index
   copyIndex
   tupleFromSpec
   reduceIndex
   refProjectionIndex

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

dedb-pyramid
   * as: py

dedb-tag
   tag
   recur

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
         // numDeps,
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         entityVars,
         outVars,
         attrsNE
      } = $.buildGoalTree(root0, attrs);

      let tuples = Array.from(indexSpecs, $.tupleFromSpec);

      for (let entityVar of entityVars) {
         if (attrs.includes(entityVar)) {
            let tuple = tuples.find(tuple => tuple[0] === entityVar);

            // $.check
            if (tuple === undefined) {

            }

         }
         
      }

      return {
         kind: 'derived',
         name: relname,
         attrs,
         tuples,
         rootGroup,
         goals,
         statefulGoals,
         // TODO: remove num deps
         // numDeps,
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         idVars,
         outVars,
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


*** Projections ***

makeProjection ::=
   function (rel, bindings) {
      let subVers = [];

      for (let [subBinding, goal] of
               $.zip($.makeSubBindings(rel, bindings), rel.statefulGoals)) {
         subVers.push($.version.refProjectionVersion(goal.rel, subBinding));
      }

      let config = $.configFor(rel, bindings);

      let subIndices = Array.from(
         config.idxReg,
         ({subNum, tuple}) => $.refProjectionIndex(subVers[subNum].proj, tuple)
      );

      /*
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
      */

      let proj = {
         kind: 'proj',
         rel,
         bindings,
         tags: new Set,
         isValid: false,
         validRevDeps: new Set,
         config,
         subVers,
         subIndices,
         indices: new Map,
         // Unlike base projections, here 'ver' can be null because a derived projection can exist
         // for its indices. Also, this is "positive version": it only tracks added records, not
         // removed ones.
         ver: null,
         curTime: 0,
         vers: new Map,
      };

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
      let boundAttrs = attrs.filter(attr => Object.hasOwn(bindings, attr));
      let key = boundAttrs.join('|');

      if (!configs.has(key)) {
         configs.set(key, $.makeConfig(rel, boundAttrs));
      }

      return configs.get(key);
   }


projectionTaggables ::=
   function* (proj) {
      yield proj;
      yield* proj.subVers;
      yield* proj.subIndices;
   }


validateProjection ::=
   function (proj) {
      for (let ver of proj.subVers) {
         ver.proj.validRevDeps.add(proj);
      }

      proj.isValid = true;
   }


*** Versions ***

makeVersionFor ::=
   function (proj) {
      return {
         kind: 'ver',
         proj,
         tags: new Set,
         time: proj.curTime,
         records: new Set,
         next: null
      }
   }


reifyCurrentVersion ::=
   function (proj) {
      if (proj.ver === null) {
         proj.curTime += 1;
         proj.ver = $.makeVersionFor(proj);
      }
      else if ($.isVersionPristine(proj.ver))
         ;
      else {
         proj.curTime += 1;

         let newVer = $.makeVersionFor(proj);

         proj.vers.set(newVer.time, newVer);

         proj.ver.next = newVer;
         proj.ver = newVer;
      }
   }


isVersionPristine ::=
   function (ver) {
      return ver.records.size === 0;
   }


releaseVersion ::=
   function (ver) {
      let {proj} = ver;

      $.assert(() => ver.refCount > 0 && proj.refCount > 0);

      ver.refCount -= 1;

      if (ver.refCount === 0) {
         proj.vers.delete(ver.time);

         // If at least 1 version is alive, then we should keep the reference to the most recent
         // version ('proj.ver'), even if 'proj.ver' itself has refCount === 0. Once we need no
         // versions at all, we can (and should) nullify 'proj.ver'.
         if (proj.vers.size === 0) {
            proj.ver = null;
         }
      }

      proj.refCount -= 1;

      if (proj.refCount === 0) {
         $.freeProjection(proj);
      }
   }


*** Running machinery ***

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
