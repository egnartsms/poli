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

      firms.push(firmBindings);

      for (let [attr, lvar] of looseBindings) {
         if (routes.has(lvar)) {
            routes.get(lvar).push([n, attr]);
         }
      }
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
         for (let [ff, vars] of $.statefulRelGoalFulfillments(goal)) {
            registerFF(vars, {
               join: ff.join,
               fitness: ff.fitness,
               count: vars.length,
               goal: goal.num,
               props: ff.props,
            });
         }

         continue;
      }
      
      if (rel.class === $.clsFuncRelation) {
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

         continue;
      }

      throw new Error;
   }

   return var2ff;
}
statefulRelGoalFulfillments ::= function* (goal) {
   let {rel, bindings} = goal;

   if (bindings.has($.recKey)) {
      let lvar = bindings.get($.recKey);

      yield [
         {
            join: $.clsJoinRecKey,
            fitness: $.Fitness.rkeyHit,
            props: {
               rkeyVar: lvar
            }
         },
         [lvar]
      ];
   }

   let indices = rel.class === $.clsBaseRelation ?
      Array.from(rel.myIndexInstances, inst => inst.index) :
      rel.indices;

   for (let index of indices) {
      let keys = [];

      for (let attr of index) {
         if (!bindings.has(attr)) {
            break;
         }

         let lvar = bindings.get(attr);

         keys.push(lvar);

         yield [
            {
               join: $.clsJoinIndex,
               fitness: $.computeFitness(keys.length, index),
               props: {
                  index,
                  keys: Array.from(keys),
               }
            },
            keys
         ];
      }
   }
}
