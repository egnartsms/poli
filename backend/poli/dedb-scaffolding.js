common
   assert
   enumerate
   map
   multimap
   mmapAdd
   many2many
   m2mAddAll
   hasOwnProperty
   zip
dedb-goal
   relGoalsBeneath
   statefulGoalsBeneath
   isStatefulRelation
   walkPaths
dedb-join-plan
   clsJoinRecKey
   clsJoinIndex
   clsJoinAll
   clsJoinFunc
   clsJoinEither
dedb-base
   clsBaseRelation
dedb-derived
   clsDerivedRelation
dedb-functional
   clsFuncRelation
dedb-rec-key
   recKey
   recVal
dedb-index
   Fitness
   computeFitness
   reduceIndex
-----
computeSubBindingRoutes ::= function (rootGoal, logAttrs) {
   let firms = [];
   let routes = new Map($.map(logAttrs, a => [a, []]));

   for (let [n, goal] of $.enumerate($.statefulGoalsBeneath(rootGoal))) {
      let {looseBindings, firmBindings} = goal;

      for (let [attr, lvar] of looseBindings) {
         if (routes.has(lvar)) {
            routes.get(lvar).push([n, attr]);
         }
      }

      firms.push(firmBindings);
   }

   return {firms, routes};
}
buildScaffolding ::= function (rootGoal) {
   let {goal2paths, path2goals} = $.computePaths(rootGoal);
   let var2ff = $.computeFulfillments(rootGoal);

   let subGoals = Array.from($.relGoalsBeneath(rootGoal), goal => ({
      rel: goal.rel,
      goal: goal.num,
      subNum: goal.statefulNum,  // -1 if it's not stateful
      bindings: goal.bindings,
      depNum: goal.depNum,  // -1 if it's not stateful
      coveredPaths: $.isStatefulRelation(goal.rel) ? goal2paths.get(goal.num) : null,
   }));

   return {
      goal2paths,
      path2goals,
      var2ff,
      subGoals: subGoals,
      subStateful: subGoals.filter(g => g.subNum !== -1),
   }
}
computePaths ::= function (rootGoal) {
   let [goal2paths, path2goals] = $.many2many();
   let goals = [];
   let path = 0;

   $.walkPaths(rootGoal, {
      onLeaf(goal, K) {
         goals.push(goal.num);
         K();
         goals.pop();
      },
      onPath() {
         $.m2mAddAll(path2goals, path, goals);
         path += 1;
      }
   });

   $.assert(() => goals.length === 0);

   return {
      goal2paths,
      path2goals
   }
}
computeFulfillments ::= function (rootGoal) {
   let var2ff = $.multimap();

   function registerFF(vars, ff) {
      if (vars.length === 0) {
         $.mmapAdd(var2ff, true, ff);
      }
      else {
         for (let lvar of vars) {
            $.mmapAdd(var2ff, lvar, ff);
         }
      }      
   }

   for (let goal of $.relGoalsBeneath(rootGoal)) {
      let {rel} = goal;

      if ($.isStatefulRelation(rel)) {
         let ffPairs;

         if (rel.class === $.clsBaseRelation) {
            ffPairs = $.baseRelGoalFulfillments(goal);
         }
         else if (rel.class === $.clsDerivedRelation) {
            ffPairs = $.derivedRelGoalFulfillments(goal);
         }
         else {
            throw new Error;
         }

         for (let [ff, vars] of ffPairs) {
            registerFF(vars, {
               join: ff.join,
               fitness: ff.fitness,
               count: vars.length,
               goal: goal.num,
               props: ff.props,
            });
         }
      }
      else if (rel.class === $.clsFuncRelation) {
         instantiation:
         for (let [icode, spec] of Object.entries(rel.instantiations)) {
            let inVars = [];
            let fetched = [];

            for (let [pm, attr] of $.zip(icode, rel.attrs)) {
               let lvar = goal.bindings.get(attr);

               if (pm === '+') {
                  if (lvar === undefined) {
                     // It's not even mentioned in bindings, so skip to the next
                     // instantiation
                     continue instantiation;
                  }
                  inVars.push(lvar);
               }
               else {
                  fetched.push(attr);
               }
            }

            registerFF(inVars, {
               join: $.clsJoinFunc,
               fitness: spec.fitness,
               count: inVars.length,
               goal: goal.num,
               props: {
                  run: spec.run,
                  fetched
               }
            });
         }
      }
      else {
         throw new Error;
      }
   }

   return var2ff;
}
baseRelGoalFulfillments ::= function* (goal) {
   let {rel, bindings, looseBindings} = goal;

   if (bindings.has($.recKey)) {
      let lvar = bindings.get($.recKey);

      yield [
         {
            join: $.clsJoinRecKey,
            fitness: $.Fitness.uniqueHit,
            props: {
               rkeyVar: lvar
            }
         },
         [lvar]
      ];
      
      if (!looseBindings.has($.recKey)) {
         // lvar is a "firm var", which means we have a rigidly keyed goal, so no point in
         // considering other fulfillments
         return;
      }
   }

   let indices = Array.from(rel.myIndexInstances, ({index}) => index);

   for (let index of indices) {
      let keys = [];
      let freeVars = [];

      function ffPair() {
         return [
            {
               join: $.clsJoinIndex,
               fitness: $.computeFitness(keys.length, index),
               props: {
                  index,
                  keys: Array.from(keys),
               }
            },
            freeVars
         ]
      }

      for (let attr of index) {
         if (!bindings.has(attr)) {
            break;
         }

         let lvar = bindings.get(attr);

         if (looseBindings.has(attr)) {
            if (keys.length > 0) {
               yield ffPair();
            }

            freeVars.push(lvar);
         }

         keys.push(lvar);
      }

      if (keys.length > 0) {
         yield ffPair();
      }
   }
}
derivedRelGoalFulfillments ::= function* (goal) {
   let {rel, firmBindings, looseBindings} = goal;

   if (firmBindings.has($.recKey)) {
      yield [
         {
            join: $.clsJoinAll,
            fitness: $.Fitness.uniqueHit,
         },
         []
      ];
      return;
   }

   if (looseBindings.has($.recKey)) {
      let lvar = looseBindings.get($.recKey);

      yield [
         {
            join: $.clsJoinRecKey,
            fitness: $.Fitness.uniqueHit,
            props: {
               rkeyVar: lvar
            }
         },
         [lvar]
      ];
   }

   let {indices} = rel;

   for (let index of indices) {
      index = $.reduceIndex(index, firmBindings.keys());

      if (index.length === 0) {
         yield [
            {
               join: $.clsJoinAll,
               fitness: index.isUnique ? $.Fitness.uniqueHit : $.Fitness.hit,
            },
            []
         ];
         continue;
      }

      let vars = [];

      for (let attr of index) {
         if (!looseBindings.has(attr)) {
            break;
         }

         vars.push(looseBindings.get(attr));

         yield [
            {
               join: $.clsJoinIndex,
               fitness: $.computeFitness(vars.length, index),
               props: {
                  index,
                  keys: Array.from(vars),
               }
            },
            vars
         ]
      }
   }
}
