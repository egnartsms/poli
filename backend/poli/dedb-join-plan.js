common
   any
   all
   assert
   arraysEqual
   arrayChain
   check
   concat
   enumerate
   find
   filter
   isSubset
   hasOwnProperty
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
   setWeedOut
   setsIntersect
   setInter
   setDiff
dedb-rec-key
   plainAttrs
   recKey
dedb-goal
   GoalType
   Shrunk
   goalLvars
   indexShrunk
   walkRelGoals
dedb-index
   superIndexOfAnother
   copyIndex
   isIndexCovered
   indexOn
-----
visualizeIncrementalUpdateScheme ::= function (rel) {
   function* gen(dconj, jpath) {
      yield `D(${dconj.rel.name})`;
      for (let link of jpath) {
         yield ` -> ${link.conj.rel.name}(${link.index.join(', ')})`;
         if (link.checkAttrs.length > 0) {
            yield ` checking (${link.checkAttrs.join(', ')})`;
         }
         if (link.extractAttrs.length > 0) {
            yield ` getting (${link.extractAttrs.join(', ')})`;
         }
      }
      yield '\n';
   }

   for (let [num, jpath] of $.enumerate(rel.config0.jpaths)) {
      let dconj = rel.config0.conjs[num];

      console.log(Array.from(gen(dconj, jpath)).join(''));
   }
}
computeIncrementalUpdatePlan ::= function (rootGoal) {
   let {goalPaths, pathGoals} = $.computePaths(rootGoal);
   let {lvar2ff, ffs0} = $.computeFulfillments(rootGoal);
   let indexRegistry = $.makeIndexRegistry();

   return {
      plan: Array.from($.walkRelGoals(rootGoal), goal => ({
         // [[attr, lvar]] to start from
         startAttrs: Array.from(goal.looseAttrs),
         joinTree: $.computeJoinTreeFrom(goal, {
            indexRegistry,
            pathGoals,
            goalPaths,
            lvar2ff,
            ffs0
         })
      })),
      appliedIndices: indexRegistry
   }
}
makeSubBoundAttrsProducer ::= function (rootGoal, attrs) {
   let firms = Array.from($.walkRelGoals(rootGoal), relGoal => relGoal.firmAttrs);
   let routes = new Map($.map(attrs, attr => [attr, []]));

   for (let [attr, route] of routes) {
      for (let {looseAttrs, num} of $.walkRelGoals(rootGoal)) {
         for (let [subAttr, lvar] of looseAttrs) {
            if (lvar === attr) {
               route.push([num, subAttr]);
               break;  // attr can be found at most once in a given goal
            }
         }
      }
   }

   return function (boundAttrs) {
      let subBounds = Array.from(firms, firm => Object.assign({}, firm));

      for (let attr of Reflect.ownKeys(boundAttrs)) {
         let route = routes.get(attr);
         if (route === undefined) {
            continue;
         }

         for (let [num, subAttr] of route) {
            subBounds[num][subAttr] = boundAttrs[attr];
         }
      }

      return subBounds;
   }
}
JoinType ::= ({
   either: 'either',
   all: 'all',
   index: 'index',
   pk: 'pk'
})
computePaths ::= function (rootGoal) {
   let [goalPaths, pathGoals] = $.many2many();
   let goals = [];

   function walk(goal, K) {
      if (goal.type === $.GoalType.rel) {
         goals.push(goal);
         K();
         goals.pop(goal);
      }
      else if (goal.type === $.GoalType.and) {
         (function rec(chain) {
            if (chain === null) {
               K();
            }
            else {
               walk(chain.item, () => rec(chain.next()))
            }
         })($.arrayChain(goal.subgoals));
      }
      else if (goal.type === $.GoalType.or) {
         for (let disjunct of goal.subgoals) {
            walk(disjunct, K);
         }
      }
      else {
         throw new Error;
      }
   }

   let pathNum = 0;

   walk(rootGoal, () => {
      $.m2mAddAll(pathGoals, pathNum, goals);
      pathNum += 1;
   });

   $.assert(() => goals.length === 0);

   return {
      goalPaths,
      pathGoals,
      numPaths: pathNum
   }
}
computeFulfillments ::= function (rootGoal) {
   let lvar2ff = $.multimap();
   let ffs0 = new Set;  // for those goals where .shrunk > Shrunk.min

   (function walk(goal) {
      if (goal.type === $.GoalType.rel) {
         if (goal.shrunk > $.Shrunk.min) {
            ffs0.add({
               joinType: $.JoinType.all,
               count: 0,
               shrunk: goal.shrunk,
               goal: goal
            });
         }

         for (let index of goal.indices) {
            let ff = {
               joinType: $.JoinType.index,
               count: index.length,
               shrunk: $.indexShrunk(index),
               goal: goal,
               index: index,
            };

            for (let attr of index) {
               $.mmapAdd(lvar2ff, goal.looseAttrs.get(attr), ff);
            }
         }

         if (goal.looseAttrs.has($.recKey)) {
            let pklvar = goal.looseAttrs.get($.recKey);

            $.mmapAdd(lvar2ff, pklvar, {
               joinType: $.JoinType.pk,
               count: 1,
               shrunk: $.Shrunk.scalar,
               goal: goal,
               pklvar: pklvar,
            })
         }
      }
      else {
         for (let subgoal of goal.subgoals) {
            walk(subgoal);
         }
      }
   })(rootGoal);

   return {lvar2ff, ffs0};
}
computeJoinTreeFrom ::= function (Dgoal, {
      indexRegistry, pathGoals, goalPaths, lvar2ff, ffs0
}) {
   let boundLvars = new Set;
   let bindStack = [];
   
   let buildTree = withStackPreserved(function (paths, goals, fulfillments, goal0) {
      $.assert(() => goals.has(goal0));

      function bindLvar(lvar) {
         $.assert(() => !boundLvars.has(lvar));

         boundLvars.add(lvar);
         bindStack.push(lvar);

         for (let ff of lvar2ff.get(lvar) ?? []) {
            $.assert(() => ff.count > 0);

            ff.count -= 1;

            if (ff.count === 0 && goals.has(ff.goal)) {
               fulfillments.add(ff);
            }
         }
      }

      function joinGoal(goal) {
         for (let lvar of $.goalLvars(goal)) {
            if (!boundLvars.has(lvar)) {
               bindLvar(lvar);
            }
         }

         goals.delete(goal);

         for (let ff of fulfillments) {
            if (ff.goal === goal) {
               fulfillments.delete(ff);
            }
         }
      }

      function bestFulfillmentToJoin() {
         if (fulfillments.size === 0) {
            return null;
         }

         return $.reduce(fulfillments, (ff1, ff2) => {
            if (ff1.shrunk > ff2.shrunk) {
               return ff1;
            }
            else if (ff1.shrunk < ff2.shrunk) {
               return ff2;
            }
            else if (isGoalFull(ff1.goal)) {
               return ff1;
            }
            else if (isGoalFull(ff2.goal)) {
               return ff2;
            }
            else {
               return ff1;
            }
         });
      }

      function isGoalFull(goal) {
         return $.isSubset(paths, goalPaths.get(goal));
      }

      joinGoal(goal0);

      let jnodeHead = null, jnodeTail = null;
      let branchFF = null;

      while (goals.size > 0) {
         let ff = bestFulfillmentToJoin();

         if (ff === null) {
            throw new Error(`Cannot join!`);
         }

         let jgoal = ff.goal;

         if (!isGoalFull(jgoal)) {
            branchFF = ff;
            break;
         }

         let jnode = makeJoinNode(ff);

         if (jnodeHead === null) {
            jnodeHead = jnodeTail = jnode;
         }
         else {
            jnodeTail.next = jnode;
            jnodeTail = jnode;
         }
         
         joinGoal(jgoal);
      }

      if (branchFF === null) {
         // All have been processed in a single branch
         return jnodeHead;
      }

      // Branching
      let eitherNode = {
         type: $.JoinType.either,
         branches: []
      };

      while (true) {
         let jgoal = branchFF.goal;

         let branchPaths = $.setInter(paths, goalPaths.get(jgoal));
         let [branchGoals, branchFulfillments] = lyingOnPaths(
            branchPaths, goals, fulfillments
         );

         let node0 = makeJoinNode(branchFF);
         node0.next = buildTree(branchPaths, branchGoals, branchFulfillments, jgoal);
         eitherNode.branches.push(node0);

         paths = $.setDiff(paths, goalPaths.get(jgoal));
         [goals, fulfillments] = lyingOnPaths(paths, goals, fulfillments);

         if (goals.size === 0) {
            break;
         }

         branchFF = bestFulfillmentToJoin();

         if (branchFF === null) {
            throw new Error(`Cannot join!`);
         }
      }

      if (jnodeTail !== null) {
         jnodeTail.next = eitherNode;

         return jnodeHead;
      }
      else {
         return eitherNode;
      }
   });

   function withStackPreserved(callback) {
      return function () {
         let n = bindStack.length;
         let res = callback.apply(this, arguments);

         while (bindStack.length > n) {
            unbind1();
         }

         return res;
      };
   }

   function lyingOnPaths(paths1, goals, fulfillments) {
      let goals1 = $.setInter(
         goals, $.concat($.map(paths1, path => pathGoals.get(path)))
      );
      let fulfillments1 = new Set($.filter(fulfillments, ff => goals.has(ff.goal)))

      return [goals1, fulfillments1];
   }

   function unbind1() {
      $.assert(() => bindStack.length > 0);

      let lvar = bindStack.pop();
      
      $.assert(() => boundLvars.has(lvar));

      boundLvars.delete(lvar);

      for (let ff of lvar2ff.get(lvar) ?? []) {
         ff.count += 1;
      }
   }

   function makeJoinNode(ff) {
      let {joinType: type, goal} = ff;

      if (type === $.JoinType.all) {
         return {
            type: $.JoinType.all,
            projNum: goal.num,
            checkAttrs: collectCheckAttrs(goal),
            extractAttrs: collectExtractAttrs(goal),
            next: null
         }
      }
      else if (type === $.JoinType.index) {
         return {
            type: $.JoinType.index,
            projNum: goal.num,
            indexNum: $.registerGoalIndex(indexRegistry, goal, ff.index),
            indexLvars: Array.from(ff.index, attr => goal.looseAttrs.get(attr)),
            checkAttrs: collectCheckAttrs(goal, ff.index),
            extractAttrs: collectExtractAttrs(goal),
            next: null
         }
      }
      else if (type === $.JoinType.pk) {
         return {
            type: $.JoinType.pk,
            projNum: goal.num,
            pklvar: goal.looseAttrs.get($.recKey),
            checkAttrs: collectCheckAttrs(goal, [$.recKey]),
            extractAttrs: collectExtractAttrs(goal),
            next: null
         }
      }
      else {
         throw new Error;
      }
   }

   function collectCheckAttrs(goal, index=null) {
      return Array.from($.mapfilter(goal.looseAttrs, ([attr, lvar]) => {
         if (boundLvars.has(lvar) && (index === null || !index.includes(attr))) {
            return [attr, lvar];
         }
      }));
   }

   function collectExtractAttrs(goal) {
      return Array.from($.mapfilter(goal.looseAttrs, ([attr, lvar]) => {
         if (!boundLvars.has(lvar)) {
            return [attr, lvar];
         }
      }));
   }

   let paths0 = new Set(goalPaths.get(Dgoal));
   let [goals0, fulfillments0] = lyingOnPaths(paths0, goalPaths.keys(), ffs0);
   return buildTree(paths0, goals0, fulfillments0, Dgoal);
}
makeIndexRegistry ::= function () {
   return [];
}
registerGoalIndex ::= function (registry, goal, index) {
   return $.registerProjNumIndex(registry, goal.num, index);
}
registerProjNumIndex ::= function (registry, projNum, index) {
   let n = registry.findIndex(({projNum: xProjNum, index: xIndex}) => {
      return xProjNum === projNum && $.arraysEqual(xIndex, index);
   });

   if (n !== -1) {
      return n;
   }

   registry.push({projNum, index});
   return registry.length - 1;
}
narrowConfig ::= function (config0, bindList) {
   let {plan, appliedIndices} = $.narrowJoinPlan(
      config0.plan, config0.appliedIndices, bindList
   );

   return {
      attrs: config0.attrs.filter(a => !bindList.includes(a)),
      plainAttrs: config0.plainAttrs === null ? null :
         config0.plainAttrs.filter(a => !bindList.includes(a)),
      lvars: config0.lvars.filter(lvar => !bindList.includes(lvar)),
      appliedIndices: appliedIndices,
      plan: plan
   }
}
narrowJoinPlan ::= function (plan, appliedIndices, bindList) {
   let indexRegistry = $.makeIndexRegistry();

   function narrow(jnode) {
      if (jnode === null) {
         return null;
      }

      if (jnode.type === $.JoinType.all) {
         return {
            type: $.JoinType.all,
            projNum: jnode.projNum,
            checkAttrs: $.narrowAttrList(jnode.checkAttrs, bindList),
            extractAttrs: $.narrowAttrList(jnode.extractAttrs, bindList),
            next: narrow(jnode.next)
         }
      }
      
      if (jnode.type === $.JoinType.index) {
         let {indexLvars, indexNum} = jnode;
         let narrowedIndex = $.copyIndex(appliedIndices[indexNum].index);

         for (let i = indexLvars.length - 1; i >= 0; i -= 1) {
            if (bindList.includes(indexLvars[i])) {
               narrowedIndex.splice(i, 1);
            }
         }

         if ($.isIndexCovered(narrowedIndex)) {
            return {
               type: $.JoinType.all,
               projNum: jnode.projNum,
               checkAttrs: $.narrowAttrList(jnode.checkAttrs, bindList),
               extractAttrs: $.narrowAttrList(jnode.extractAttrs, bindList),
               next: narrow(jnode.next)
            }
         }
         else {
            return {
               type: $.JoinType.index,
               projNum: jnode.projNum,
               indexNum: $.registerProjNumIndex(
                  indexRegistry, jnode.projNum, narrowedIndex
               ),
               indexLvars: jnode.indexLvars.filter(lvar => !bindList.includes(lvar)),
               checkAttrs: $.narrowAttrList(jnode.checkAttrs, bindList),
               extractAttrs: $.narrowAttrList(jnode.extractAttrs, bindList),
               next: narrow(jnode.next)
            }
         }
      }
      
      if (jnode.type === $.JoinType.pk) {
         if (bindList.includes(jnode.pklvar)) {
            return {
               type: $.JoinType.all,
               projNum: jnode.projNum,
               checkAttrs: $.narrowAttrList(jnode.checkAttrs, bindList),
               extractAttrs: $.narrowAttrList(jnode.extractAttrs, bindList),
               next: narrow(jnode.next)
            }
         }
         else {
            return {
               type: $.JoinType.pk,
               projNum: jnode.projNum,
               pklvar: jnode.pklvar,
               checkAttrs: $.narrowAttrList(jnode.checkAttrs, bindList),
               extractAttrs: $.narrowAttrList(jnode.extractAttrs, bindList),
               next: narrow(jnode.next)
            }
         }
      }

      if (jnode.type === $.JoinType.either) {
         return {
            type: $.JoinType.either,
            branches: Array.from(jnode.branches, narrow)
         }
      }

      throw new Error;
   }

   return {
      plan: Array.from(plan, ({startAttrs, joinTree}) => ({
         startAttrs: startAttrs.filter(([attr, lvar]) => !bindList.includes(lvar)),
         joinTree: narrow(joinTree)
      })),
      appliedIndices: indexRegistry
   }
}
narrowAttrList ::= function (attrList, bindList) {
   return attrList.filter(([attr, lvar]) => !bindList.includes(lvar));
}
