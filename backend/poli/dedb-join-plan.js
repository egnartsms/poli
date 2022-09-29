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

-----

visualizeIncrementalUpdateScheme ::=
   function* (rel) {
      // tbd
   }


makeConfig ::=
   function (rel, boundAttrs) {
      function isNotBound(v) {
         return !boundAttrs.includes(v);
      }

      function isDeadBound(v) {
         return (
            boundAttrs.includes(v) ||
            rel.firmVarBindings.has(v) ||
            rel.fictitiousVars.has(v)
         )
      }

      let idxReg = [];
      let vpool = $.makeAnonymousVarPool();
      let fulfillments = new Map;

      for (let goal of rel.goals) {
         let ffs;

         if (goal.isStateful) {
            if (goal.isDerived) {
               ffs = $.derivedGoalFulfillments(goal, isDeadBound);
            }
            else {
               ffs = $.baseGoalFulfillments(goal);
            }

            ffs = Array.from(ffs);
         }
         else {
            ffs = Array.from($.funcGoalFulfillments(goal, vpool));
         }

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
      let boundVars = [
         ...rel.firmVarBindings.keys(),
         ...rel.fictitiousVars,
         ...boundAttrs
      ];
      let committedChoices = [];

      function isBound(lvar) {
         return boundVars.includes(lvar);
      }

      function isDeadBound(lvar) {
         return (
            rel.firmVarBindings.has(lvar) ||
            rel.fictitiousVars.has(lvar) ||
            boundAttrs.includes(lvar)
         )
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

         if (ff.join === 'all') {
            return {
               kind: 'all',
               subNum: goal.subNum,
               ...propsForCheckExtract(goal.bindings),
               next: null
            }
         }

         if (ff.join === 'index') {
            let keys = Array.from($.takeWhile(ff.keys, isBound));

            $.assert(() => keys.length > 0);

            return {
               kind: 'index',
               subNum: goal.subNum,
               indexNum: $.registerIndex(idxReg, goal.subNum, ff.index),
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
            if (isDeadBound(lvar)) {
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
         if (ff.join === 'all') {
            return ff.fitness;
         }

         if (ff.join === 'func') {
            return $.all(ff.inVars, isBound) ? ff.fitness : $.Fitness.minimum;
         }

         if (ff.join === 'index') {
            return $.tupleFitnessByBounds(ff.index, Array.from(ff.keys, isBound));
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
               let branches = null;

               try {
                  branches = Array.from(choice.alts, withStackRestored(alt => {
                     committedChoices.push(choice);
                     return buildTree(branchGoals(goals, choice, alt), alt);
                  }));
               }
               catch (e) {
                  if (!(e instanceof $.CannotJoinError) || nFF === null) {
                     throw e;
                  }

                  // Try the no-branching (nFF) fulfillment
               }

               if (branches !== null) {
                  addTail({
                     kind: 'either',
                     choice,
                     branches
                  });

                  break;
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

      for (let {index} of rel.myInsts) {
         let keys = [];

         for (let attr of index) {
            if (!bindings.has(attr)) {
               break;
            }

            keys.push(bindings.get(attr));
         }

         if (keys.length > 0) {
            yield {
               goal,
               join: 'index',
               index,
               keys
            }
         }
      }
   }

derivedGoalFulfillments ::=
   function* (goal, isDeadBound) {
      let {bindings, rel} = goal;

      for (let sourceIndex of rel.indices) {
         let index = [];
         let keys = [];
         let worked = false;

         for (let attr of sourceIndex) {
            if (!bindings.has(attr)) {
               break;
            }

            let lvar = bindings.get(attr);

            if (!isDeadBound(lvar)) {
               index.push(attr);
               keys.push(lvar);
            }

            worked = true;
         }

         if (!worked) {
            continue;
         }

         if (index.length === 0) {
            yield {
               goal,
               join: 'all',
               fitness: sourceIndex.isUnique ? $.Fitness.uniqueHit : $.Fitness.hit,
            }
         }
         else {
            index.isUnique = sourceIndex.isUnique;

            yield {
               goal,
               join: 'index',
               index,
               keys
            }
         }
      }
   }

registerIndex ::=
   function (registry, subNum, index) {
      let n = registry.findIndex(({subNum: xSubNum, index: xIndex}) => {
         return xSubNum === subNum && $.arraysEqual(xIndex, index);
      });

      if (n !== -1) {
         return n;
      }

      registry.push({subNum, index});
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
         lvar = `--anon-${vpool.length}`;
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
