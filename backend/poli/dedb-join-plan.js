common
   any
   all
   assert
   arraysEqual
   arrayChain
   check
   chain
   enumerate
   find
   filter
   greatestBy
   indexRange
   isSubset
   hasOwnProperty
   ownPropertyValue
   map
   mapfilter
   ownEntries
   produceArray
   keyForValue
   zip
   many2many
   m2mAdd
   m2mAddAll
   m2mHas
   mmapAdd
   multimap
   reduce
   takeWhile

set-map
   intersection
   difference
   intersect
   purgeSet

dedb-rec-key
   recKey
   recVal

dedb-goal
   relGoalsBeneath

dedb-index
   Fitness
   superIndexOfAnother
   copyIndex
   isFullyCoveredBy
   tupleFitnessByBounds
   reduceIndex

dedb-projection
   projectionFor

dedb-base
   entity

-----

visualizeIncrementalUpdateScheme ::=
   function* (rel) {
      // tbd
   }


makeConfig ::=
   function (rel, boundAttrs) {
      let firmlyBounds = $.union(boundAttrs, rel.firmVarBindings.keys(), rel.fictitiousVars);

      let idxReg = [];
      let vpool = $.makeAnonymousVarPool();
      let fulfillments = new Map;

      for (let goal of rel.goals) {
         let ffs;

         if (goal.isStateful) {
            if (goal.isDerived) {
               ffs = $.derivedGoalFulfillments(goal, firmlyBounds);
            }
            else {
               ffs = $.baseGoalFulfillments(goal);
            }
         }
         else {
            ffs = $.funcGoalFulfillments(goal, vpool);
         }

         ffs = Array.from(ffs);

         if (ffs.length === 0) {
            throw new Error(`No fulfillments found!`);
         }

         fulfillments.set(goal, ffs);
      }

      let joinSpecs = Array.from(rel.statefulGoals, goal => {
         return $.computeJoinSpec(rel, boundAttrs, fulfillments, goal, idxReg, vpool);
      });

      let vars = rel.vars.filter(v => !boundAttrs.includes(v)).concat(vpool);

      if (vpool.dumbVarCreated) {
         vars.push($.dumbVar);
      }

      return {
         attrs: rel.attrs.filter(v => !boundAttrs.includes(v)),
         // bound attrs that are non-evaporatable
         nonEvaporated: rel.attrs.filter(a => boundAttrs.includes(a) && rel.attrsNE.has(a)),
         // array of variables used in computations. Does not include non-evaporated and
         // firm vars
         vars,
         idxReg,
         joinSpecs
      };
   }


computeJoinSpec ::=
   function (rel, boundAttrs, fulfillments, Dgoal, idxReg, vpool) {
      let firmlyBounds = $.union(rel.firmVarBindings.keys(), rel.fictitiousVars, boundAttrs);
      let boundVars = [...firmlyBounds];
      let committedChoices = [];

      function isBound(lvar) {
         return boundVars.includes(lvar);
      }

      function topmostUncommittedChoice(goal) {
         let topmost = null;
         let choice = goal.parentGroup.parentChoice;

         while (choice !== null && !committedChoices.includes(choice)) {
            topmost = choice;
            choice = choice.parentGroup.parentChoice;
         }

         return topmost;
      }

      function isUnderGroup(goal, ancestorGroup) {
         let group = goal.parentGroup;
         
         while (group !== ancestorGroup && group.parentChoice !== null) {
            group = group.parentChoice.parentGroup;
         }

         return group === ancestorGroup;
      }

      function isUnderChoice(goal, ancestorChoice) {
         let choice = goal.parentGroup.parentChoice;

         while (choice !== null && choice !== ancestorChoice) {
            choice = choice.parentGroup.parentChoice;
         }

         return choice === ancestorChoice;
      }

      function branchGoals(goals, choice, alt) {
         return new Set(
            $.filter(goals, g => !isUnderChoice(g, choice) || isUnderGroup(g, alt))
         );
      }

      function branchGoalsMulti(goals, choice2alt) {
         return new Set(
            $.filter(goals, g => {
               let group = g.parentGroup;
               let choice = group.parentChoice;

               while (choice !== null && !choice2alt.has(choice)) {
                  group = choice.parentGroup;
                  choice = group.parentChoice;
               }

               return choice === null || group === choice2alt.get(choice)
            })
         );
      }

      function choiceMap(goal) {
         let group = goal.parentGroup;
         let choice = group.parentChoice;
         let choice2alt = new Map;

         while (choice !== null) {
            choice2alt.set(choice, group);
            group = choice.parentGroup;
            choice = group.parentChoice;
         }

         return choice2alt;
      }

      function withStackRestored(callback) {
         return (...args) => {
            let nVars = boundVars.length;
            let nChoices = committedChoices.length;

            try {
               return callback(...args);
            }
            finally {
               committedChoices.length = nChoices;
               boundVars.length = nVars;
            }
         }
      }

      function bindGoalFreeVars(goal) {
         for (let [, lvar] of goal.bindings) {
            if (!isBound(lvar)) {
               boundVars.push(lvar);
            }
         }
      }

      function makeJoinNode(ff) {
         if (ff.join === 'func') {
            let args = [];
            let toCheck = [];

            $.resetVarPool(vpool);

            for (let [pm, lvar] of ff.args) {
               if (pm === '+') {
                  args.push(lvar);
               }
               else if (isBound(lvar)) {
                  let temp = $.getHelperVar(vpool);

                  args.push(temp);
                  toCheck.push([temp, lvar]);
               }
               else {
                  args.push(lvar);
               }
            }

            return {
               kind: 'func',
               run: ff.run,
               args,
               toCheck,
               next: null,
            }
         }

         let {goal} = ff;

         $.assert(() => goal.isStateful);

         if (ff.join === 'entity') {
            return {
               kind: 'entity',
               subNum: goal.subNum,
               ...propsForCheckExtract(goal.bindings),
               next: null
            }
         }

         if (ff.join === 'index') {
            let keys = Array.from($.takeWhile(ff.keys, isBound));

            return {
               kind: 'index',
               subNum: goal.subNum,
               indexNum: $.registerIndex(idxReg, goal.subNum, ff.tuple),
               indexKeys: keys,
               ...propsForCheckExtract(goal.bindings, keys),
               next: null
            }
         }
      
         throw new Error;
      }

      function propsForCheckExtract(bindings, noCheck=[]) {
         let toCheck = [];
         let toExtract = [];

         for (let [attr, lvar] of bindings) {
            if (firmlyBounds.has(lvar)) {
               continue;
            }

            if (isBound(lvar)) {
               if (!noCheck.includes(lvar)) {
                  toCheck.push([attr, lvar]);
               }
            }
            else {
               toExtract.push([attr, lvar]);
            }
         }

         return {
            toCheck,
            toExtract,
         }
      }

      function ffFitness(ff) {
         if (ff.join === 'func') {
            return $.all(ff.inVars, isBound) ? ff.fitness : $.Fitness.minimum;
         }

         if (ff.join === 'entity') {
            return isBound(ff.lvar) ? $.Fitness.entityHit : $.Fitness.minimum;
         }

         if (ff.join === 'index') {
            return $.tupleFitness(ff.tuple, Array.from(ff.keys, isBound));
         }

         throw new Error;
      }

      function buildTree(goals, startGroup=null) {
         function findBestFulfillment(group=null) {
            let nFit = $.Fitness.minimum;
            let nFF = null;
            let bFit = $.Fitness.minimum;
            let bFF = null;

            for (let goal of goals) {
               if (group !== null && !isUnderGroup(goal, group)) {
                  continue;
               }

               let impliesBranching = 
                  (goal.parentGroup.parentChoice !== null) &&
                  !committedChoices.includes(goal.parentGroup.parentChoice);

               for (let ff of fulfillments.get(goal)) {
                  let fit = ffFitness(ff);

                  if (fit === $.Fitness.minimum) {
                     continue;
                  }

                  if (impliesBranching) {
                     if (fit > bFit) {
                        bFit = fit;
                        bFF = ff;
                     }
                  }
                  else {
                     if (fit > nFit) {
                        nFit = fit;
                        nFF = ff;
                     }
                  }
               }
            }
            
            return {nFit, nFF, bFit, bFF}
         }

         let jhead = null;
         let jtail = null;

         function addTail(jnode) {
            if (jhead === null) {
               jhead = jtail = jnode;
            }
            else {
               jtail.next = jnode;
               jtail = jnode;
            }
         }

         let {nFit, nFF, bFit, bFF} = findBestFulfillment(startGroup);

         for (;;) {
            if (nFF === null && bFF === null) {
               throw new $.CannotJoinError;
            }

            if (bFit > nFit) {
               let choice = topmostUncommittedChoice(bFF.goal);

               try {
                  let branches = Array.from(choice.alts, withStackRestored(alt => {
                     committedChoices.push(choice);
                     return buildTree(branchGoals(goals, choice, alt), alt);
                  }));

                  addTail({
                     kind: 'either',
                     choice,
                     branches
                  });

                  break;
               }
               catch (e) {
                  if (!(e instanceof $.CannotJoinError)) {
                     throw e;
                  }

                  if (nFF === null) {
                     throw e;
                  }

                  // Try the no-branching (nFF) fulfillment
               }
            }

            addTail(makeJoinNode(nFF));
            bindGoalFreeVars(nFF.goal);
            goals.delete(nFF.goal);

            if (goals.size === 0) {
               break;
            }

            ({nFit, nFF, bFit, bFF} = findBestFulfillment());
         }

         return jhead;
      }

      let {toExtract} = propsForCheckExtract(Dgoal.bindings);

      let choice2alt = choiceMap(Dgoal);
      let goals = branchGoalsMulti(rel.goals, choice2alt);

      committedChoices.push(...choice2alt.keys());
      goals.delete(Dgoal);
      bindGoalFreeVars(Dgoal);

      return {
         jroot: buildTree(goals),
         toExtract,
         depNum: Dgoal.depNum,
      }
   }


CannotJoinError ::= class CannotJoinError extends Error {}


funcGoalFulfillments ::=
   function* (goal, vpool) {
      $.assert(() => !goal.isStateful);

      let {rel, bindings} = goal;

      instantiation:
      for (let [icode, spec] of Object.entries(rel.instantiations)) {
         let args = [], inVars = [];

         for (let [pm, attr] of $.zip(icode, rel.attrs)) {
            let lvar = bindings.get(attr);

            if (pm === '+') {
               if (lvar === undefined) {
                  // It's not even mentioned in bindings, so skip to the next instantiation
                  continue instantiation;
               }

               inVars.push(lvar);
            }
            else {
               lvar ??= $.getDumbVar(vpool);
            }

            args.push([pm, lvar]);
         }

         yield {
            goal,
            join: 'func',
            fitness: spec.fitness,
            run: spec.run,
            args,
            inVars,
         }
      }
   }


baseGoalFulfillments ::=
   function* (goal) {
      let {bindings, rel} = goal;

      for (let {tuple} of rel.indices) {
         let keys = [];

         for (let attr of tuple) {
            if (!bindings.has(attr)) {
               break;
            }

            keys.push(bindings.get(attr));
         }

         if (keys.length > 0) {
            yield {
               goal,
               join: 'index',
               tuple,
               keys
            }
         }
      }

      if (rel.protoEntity !== null) {
         $.assert(() => bindings.has($.entity));

         yield {
            goal,
            join: 'entity',
            lvar: bindings.get($.entity)
         }
      }
   }


derivedGoalFulfillments ::=
   function* (goal, firmlyBounds) {
      let {bindings, rel} = goal;

      for (let fullTuple of rel.tuples) {
         let tuple = $.reduceTuple(
            fullTuple, attr => bindings.has(attr) && firmlyBounds.has(bindings.get(attr))
         );
         let keys = Array.from($.mapStop(tuple, attr => bindings.get(attr)));

         if (keys.length === 0 && !tuple.isNoMatchFine) {
            continue;
         }

         yield {
            goal,
            join: 'index',
            tuple,
            keys
         }
      }
   }

fuck :css:=
   li.hey {
      border-width: 20px;
   }

   p.gay {
      margin-top: 10rem;
   }


registerIndex ::=
   function (registry, subNum, tuple) {
      let n = registry.findIndex(({subNum: xSubNum, tuple: xTuple}) => {
         return xSubNum === subNum && $.arraysEqual(xTuple, tuple);
      });

      if (n !== -1) {
         return n;
      }

      registry.push({subNum, tuple});
      return registry.length - 1;
   }


makeAnonymousVarPool ::=
   function () {
      return Object.assign([], {
         idx: 0,
         dumbVarUsed: false
      });
   }


getHelperVar ::=
   function (vpool) {
      let lvar;

      if (vpool.idx < vpool.length) {
         lvar = vpool[vpool.idx];
      }
      else {
         lvar = `-anon-${vpool.length}`;
         vpool.push(lvar);
      }

      vpool.idx += 1;

      return lvar;      
   }


resetVarPool ::=
   function (vpool) {
      vpool.idx = 0;
   }


getDumbVar ::=
   function (vpool) {
      vpool.dumbVarUsed = true;
      return $.dumbVar;
   }

   
dumbVar ::= '-dumb'
