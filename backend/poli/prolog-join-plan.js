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
prolog-rec-key
   plainAttrs
   recKey
prolog-goal
   GoalType
   Shrunk
   goalLvars
   reduceConjIndex
   reduceConj
   indexShrunk
   walkRelGoals
prolog-index
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
   let {goalPaths, pathGoals, numPaths} = $.computePaths(rootGoal);
   let {lvar2ff, ffs0} = $.computeFulfillments(rootGoal);
   let indexRegistry = $.makeIndexRegistry();

   return {
      plan: Array.from($.walkRelGoals(rootGoal), relGoal => ({
         // [[attr, lvar]] to start from
         startAttrs: Array.from(relGoal.looseAttrs),
         joinTree: $.computeJoinTreeFrom(relGoal, {
            indexRegistry,
            pathGoals,
            goalPaths,
            numPaths,
            lvar2ff,
            ffs0
         }),
         getFirmAttrs () {
            return relGoal.firmAttrs
         }
      })),
      appliedIndices: indexRegistry
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
      indexRegistry, pathGoals, goalPaths, numPaths, lvar2ff, ffs0
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
            index: $.registerIndex(indexRegistry, goal, ff.index),
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
registerIndex ::= function (registry, goal, index) {
   let n = registry.findIndex(({projNum, index: xindex}) => {
      return projNum === goal.num && $.arraysEqual(xindex, index);
   });

   if (n !== -1) {
      return n;
   }

   registry.push({projNum: goal.num, index});
   return registry.length - 1;
}
narrowConfig ::= function (config0, boundAttrs) {
   let n_conjs = Array.from(config0.conjs, conj => $.reduceConj(conj, boundAttrs));
   let reg = $.makeIndexRegistryPerConj(config0.conjs.length);
   let n_jpaths = config0.jpaths.map(jpath => jpath.map(
      jplink => $.narrowJplink(jplink, config0, boundAttrs, reg)
   ));

   let appliedIndices = reg.flat();

   n_jpaths = $.joinPathsWithIndexNums(n_jpaths, appliedIndices);

   let n_config = {
      conjs: n_conjs,
      attrs: config0.attrs.filter(a => !$.hasOwnProperty(boundAttrs, a)),
      plainAttrs: null,
      lvars: config0.lvars.filter(lvar => !$.hasOwnProperty(boundAttrs, lvar)),
      jpaths: n_jpaths,
      appliedIndices,
   };

   n_config.plainAttrs = $.plainAttrs(n_config.attrs);

   return n_config;
}
narrowJplink ::= function (jplink, config0, boundAttrs, indexRegistry) {
   let {type, conjNum, checkAttrs, extractAttrs} = jplink;

   let n_checkAttrs = $.narrowAttrList(checkAttrs, boundAttrs);
   let n_extractAttrs = $.narrowAttrList(extractAttrs, boundAttrs);

   if (type === $.JoinLinkType.all) {
      return {
         type,
         conjNum,
         checkAttrs: n_checkAttrs,
         extractAttrs: n_extractAttrs,
      }
   }
   else if (type === $.JoinLinkType.pk) {
      let {pkLvar} = jplink;

      if ($.hasOwnProperty(boundAttrs, pkLvar)) {
         return {
            type: $.JoinLinkType.all,
            conjNum,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
      else {
         return {
            type: $.JoinLinkType.pk,
            conjNum,
            pkLvar,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs
         }
      }
   }
   else {
      $.assert(() => type === $.JoinLinkType.indexed);

      let {indexNum} = jplink;
      let conj = config0.conjs[conjNum];
      let n_index = $.reduceConjIndex(conj, config0.appliedIndices[indexNum], boundAttrs);

      if ($.isIndexCovered(n_index)) {
         return {
            type: $.JoinLinkType.all,
            conjNum,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
      else {
         n_index = $.addToIndexRegistry(indexRegistry, conjNum, n_index, () => {
            n_index.forConjNum = conjNum;
            return n_index;
         });

         return {
            type: $.JoinLinkType.indexed,
            conjNum,
            index: n_index,  // will be replaced with 'indexNum'
            indexLvars: Array.from(n_index, attr => conj.looseAttrs.get(attr)),
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
   }
}
narrowAttrList ::= function (attrList, boundAttrs) {
   return attrList.filter(([attr, lvar]) => !$.hasOwnProperty(boundAttrs, lvar));
}
