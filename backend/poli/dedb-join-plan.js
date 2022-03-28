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
   indexFitnessByBounds
   reduceIndex
dedb-projection
   projectionFor
-----
visualizeIncrementalUpdateScheme ::= function* (rel) {
   // tbd
}
makeConfig ::= function (rel, boundAttrs) {
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
         ffs = $.statefulGoalFulfillments(goal);
         ffs = goal.isDerived ?
            Array.from(ffs, ff => $.reduceByDeadBound(ff, isDeadBound)) :
            Array.from(ffs);
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
      return $.computeJoinTreeFrom(rel, boundAttrs, fulfillments, goal, idxReg, vpool);
   });

   let vars = rel.vars.filter(v => !boundAttrs.includes(v)).concat(vpool.vars);

   if (vpool.dumbVarCreated) {
      vars.push($.dumbVar);
   }

   return {
      attrs: rel.attrs.filter(v => !boundAttrs.includes(v)),
      // bound logAttrs that are non-evaporatable
      nonEvaporated: rel.logAttrs.filter(
         a => boundAttrs.includes(a) && rel.varsNE.has(a)
      ),
      // array of variables used in computations. Does not include non-evaporated and firm
      // vars
      vars,
      idxReg,
      joinSpecs
   };
}
computeJoinTreeFrom ::= function (rel, boundAttrs, fulfillments, Dgoal, idxReg, vpool) {
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

      while (choice !== null && committedChoices.includes(choice)) {
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

   function withStackRestored(callback) {
      return (...args) => {
         let nVars = boundVars.length;
         let nChoices = committedChoices.length;

         let result = callback(...args);

         committedChoices.length = nChoices;
         boundVars.length = nVars;

         return result;
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

      if (ff.join === 'rec-key') {
         return {
            kind: 'rec-key',
            subNum: goal.subNum,
            rkeyVar: ff.rkeyVar,
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
      let rkeyExtract = null;
      let rvalExtract = null;
      let rvalCheck = null;

      for (let [attr, lvar] of bindings) {
         if (isDeadBound(lvar)) {
            continue;
         }

         if (attr === $.recKey) {
            if (isBound(lvar)) {
               // Nothing to do here as bound recKey should've been used in a 'rec-key'
               // join node
            }
            else {
               rkeyExtract = lvar;
            }
         }
         else if (attr === $.recVal) {
            if (isBound(lvar)) {
               rvalCheck = lvar;
            }
            else {
               rvalExtract = lvar;
            }
         }
         else if (isBound(lvar)) {
            if (!noCheck.includes(lvar)) {
               toCheck.push([attr, lvar]);
            }
         }
         else {
            toExtract.push([attr, lvar]);
         }
      }

      return {
         rkeyExtract,
         rvalExtract,
         rvalCheck,
         toCheck,
         toExtract,
      }
   }

   function ffFitness(ff) {
      if (ff.join === 'all') {
         return ff.fitness;
      }

      if (ff.join === 'rec-key') {
         return isBound(ff.rkeyVar) ? $.Fitness.rkeyHit : $.Fitness.minimum;
      }

      if (ff.join === 'index') {
         return $.indexFitnessByBounds(ff.index, Array.from(ff.keys, isBound));
      }

      throw new Error;
   }

   function buildTree(goals, startGroup=null) {
      function findBestFulfillment(group=null) {
         let [ff, fitness] = $.greatestBy(
            function* () {
               for (let goal of goals) {
                  if (group === null || isUnderGroup(goal, group)) {
                     yield* fulfillments.get(goal);
                  }
               }
            }(),
            ffFitness
         );

         if (fitness === $.Fitness.minimum) {
            throw new Error(`Cannot join!`);
         }

         return ff;
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

      let ff = findBestFulfillment(startGroup);

      for (;;) {
         let choice = topmostUncommittedChoice(ff.goal);

         if (choice !== null) {
            let branches = Array.from(choice.alts, withStackRestored(alt => {
               committedChoices.push(choice);
               return buildTree(branchGoals(goals, choice, alt), alt);
            }));

            addTail({
               join: 'either',
               choice,
               branches
            });

            break;
         }

         addTail(makeJoinNode(ff));
         bindGoalFreeVars(ff.goal);
         goals.delete(ff.goal);

         if (goals.size === 0) {
            break;
         }

         ff = findBestFulfillment();
      }

      return jhead;
   }

   let {rkeyExtract, rvalExtract, toExtract} = propsForCheckExtract(Dgoal.bindings);

   let goals;

   if (Dgoal.parentGroup.parentChoice === null) {
      goals = new Set(rel.goals);
   }
   else {
      goals = branchGoals(rel.goals, Dgoal.parentGroup.parentChoice, Dgoal.parentGroup);
      committedChoices.push(Dgoal.parentGroup.parentChoice);
   }

   goals.delete(Dgoal);
   bindGoalFreeVars(Dgoal);

   return {
      jroot: buildTree(goals),
      rkeyExtract,
      rvalExtract,
      toExtract,
      depNum: Dgoal.depNum,
   }
}
funcGoalFulfillments ::= function* (goal, vpool) {
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
statefulGoalFulfillments ::= function* (goal) {
   let {bindings, rel} = goal;

   if (bindings.has($.recKey)) {
      yield {
         goal,
         join: 'rec-key',
         rkeyVar: bindings.get($.recKey)
      }
   }

   let indices = goal.isDerived ? rel.indices :
      Array.from(rel.myIndexInstances, inst => inst.index);

   for (let index of indices) {
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
reduceByDeadBound ::= function (ff, isDeadBound) {
   $.assert(() => ff.goal.isStateful && ff.goal.isDerived);

   if (ff.join === 'rec-key') {
      if (isDeadBound(ff.rkeyVar)) {
         return {
            goal: ff.goal,
            join: 'all',
            fitness: $.Fitness.rkeyHit,
         }
      }
      else {
         return ff;
      }
   }

   if (ff.join === 'index') {
      let {bindings} = goal;

      let rindex = $.reduceIndex(
         ff.index, attr => bindings.has(attr) && isDeadBound(bindings.get(attr))
      );

      if (rindex.length === 0) {
         return {
            goal: ff.goal,
            join: 'all',
            fitness: ff.index.isUnique ? $.Fitness.uniqueHit : $.Fitness.hit,
         }
      }
      else {
         return {
            goal: ff.goal,
            join: 'index',
            index: rindex,
            keys: ff.keys.filter(lvar => !isDeadBound(lvar))
         }
      }
   }

   throw new Error;
}
registerIndex ::= function (registry, subNum, index) {
   let n = registry.findIndex(({subNum: xSubNum, index: xIndex}) => {
      return xSubNum === subNum && $.arraysEqual(xIndex, index);
   });

   if (n !== -1) {
      return n;
   }

   registry.push({subNum, index});
   return registry.length - 1;
}
makeAnonymousVarPool ::= function () {
   return Object.assign([], {
      idx: 0,
      dumbVarUsed: false
   });
}
getHelperVar ::= function (vpool) {
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
resetVarPool ::= function (vpool) {
   vpool.idx = 0;
}
getDumbVar ::= function (vpool) {
   vpool.dumbVarUsed = true;
   return $.dumbVar;
}
dumbVar ::= '--dumb'
