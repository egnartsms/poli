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
   setWeedOut
   setsIntersect
   setInter
   setDiff
dedb-rec-key
   recKey
dedb-goal
   Shrunk
   goalLvars
   indexShrunk
   walkPaths
   instantiationShrunk
   clsRelGoal
   clsFuncGoal
   relGoalsBeneath
dedb-index
   Fitness
   superIndexOfAnother
   copyIndex
   isFullyCoveredBy
   reduceIndex
   computeFitness
dedb-base
   clsBaseRelation
dedb-projection
   projectionFor
-----
visualizeIncrementalUpdateScheme ::= function (rel) {
   throw new Error;

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
computeIncrementalUpdatePlan ::= function (rootGoal, logicalAttrs) {
   let {goalPaths, pathGoals} = $.computePaths(rootGoal);
   let lvar2ff = $.computeFulfillments(rootGoal);
   let indexRegistry = $.makeIndexRegistry();

   return {
      plan: Array.from($.relGoalsBeneath(rootGoal), goal => ({
         rkeyLvar: goal.rkeyLvar,
         // [[attr, lvar]] to start from
         start: Object.entries(goal.looseBindings),
         joinTree: $.computeJoinTreeFrom(goal, {
            indexRegistry,
            pathGoals,
            goalPaths,
            lvar2ff,
         })
      })),
      appliedIndices: indexRegistry,
      subsProducer: $.makeSubsProducer(rootGoal, logicalAttrs, goalPaths),
      numPaths: pathGoals.size
   }
}
makeSubsProducer ::= function (rootGoal, logicalAttrs, goalPaths) {
   let info = Array.from($.relGoalsBeneath(rootGoal), goal => {
      return {
         rel: goal.rel,
         depNum: goal.depNum,
         firms: goal.firmBindings,
         loose: Array.from(
            $.mapfilter(
               Object.entries(goal.looseBindings), ([attr, lvar]) => {
                  if (logicalAttrs.includes(lvar)) {
                     return [lvar, attr];
                  }
               }
            )
         ),
         rkeyBound: goal.rkeyBound,
         rkeyAttr: (
            goal.rkeyLvar !== null && logicalAttrs.include(goal.rkeyLvar) ?
               goal.rkeyLvar :
               null
         ),
         coveredPaths: goalPaths.get(goal)
      }
   });
   
   return function* (rkey, bindings) {
      if (rkey !== undefined) {
         bindings = {...bindings, [$.recKey]: rkey};
      }

      for (let [
                  i, 
                  {
                     rel,
                     depNum,
                     firms,
                     loose,
                     rkeyBound,
                     rkeyAttr,
                     coveredPaths
                  }
               ] of $.enumerate(info)) {
         let sub = {...firms};

         for (let [attr, subAttr] of loose) {
            if ($.ownPropertyValue(bindings, attr) !== undefined) {
               sub[subAttr] = bindings[attr];
            }
         }

         let proj = $.projectionFor(
            rel,
            rkeyBound !== undefined ? rkeyBound :
               rkeyAttr !== null ? bindings[rkeyAttr] : undefined,
            sub
         );

         proj.refCount += 1;

         yield {
            num: i,
            proj,
            ver: null,
            depNum,
            coveredPaths
         };
      }
   };
}
clsJoin ::= ({
   name: 'join',
   'join': true
})
clsJoinAll ::= ({
   name: 'join.all',
   'join': true,
   'join.all': true
})
clsJoinIndex ::= ({
   name: 'join.index',
   'join': true,
   'join.index': true
})
clsJoinRecKey ::= ({
   name: 'join.recKey',
   'join': true,
   'join.recKey': true
})
clsJoinEither ::= ({
   name: 'join.either',
   'join.either': true,
   'join': true
})
clsJoinFunc ::= ({
   name: 'join.func',
   'join.func': true,
   'join': true
})
computePaths ::= function (rootGoal) {
   let [goalPaths, pathGoals] = $.many2many();
   let goals = [];
   let pathNum = 0;

   $.walkPaths(rootGoal, {
      onLeaf: (goal, K) => {
         goals.push(goal);
         K();
         goals.pop();
      },
      onPath: () => {
         $.m2mAddAll(pathGoals, pathNum, goals);
         pathNum += 1;
      }
   });

   $.assert(() => goals.length === 0);

   return {
      goalPaths,
      pathGoals
   }
}
computeFulfillments ::= function (rootGoal) {
   let lvar2ff = $.multimap();

   (function walk(goal) {
      if (goal.class === $.clsRelGoal) {
         for (let [ff, lvars] of $.relGoalFulfillments(goal)) {
            ff = {
               join: ff.join,
               fitness: ff.fitness,
               count: lvars.length,
               goal: goal,
               props: ff.props,
            };

            if (lvars.length === 0) {
               $.mmapAdd(lvar2ff, true, ff);
            }
            else {
               for (let lvar of lvars) {
                  $.mmapAdd(lvar2ff, lvar, ff);
               }
            }
         }
      }
      else if (goal.class === $.clsFuncGoal) {
         throw new Error;

         let {rel} = goal;
         let plusMinus = new Array(rel.attrs.length);
         let lvars = new Set;

         (function rec(i) {
            if (i === rel.attrs.length) {
               let icode = plusMinus.join('');

               if ($.hasOwnProperty(rel.instantiations, icode)) {
                  let {shrunk} = rel.instantiations[icode];
                  let ff = {
                     joinType: $.JoinType.func,
                     count: lvars.size,
                     shrunk,
                     goal,
                     icode,
                  };

                  if (lvars.size === 0) {
                     ffs0.add(ff);
                  }
                  else {
                     for (let lvar of lvars) {
                        $.mmapAdd(lvar2ff, lvar, ff);
                     }
                  }
               }

               return;
            }

            let attr = rel.attrs[i];

            if ($.hasOwnProperty(goal.firmAttrs, attr)) {
               plusMinus[i] = '+';
               rec(i + 1);
            }
            else {
               let lvar = goal.looseAttrs.get(attr);

               plusMinus[i] = '-';
               rec(i + 1);

               plusMinus[i] = '+';
               lvars.add(lvar);
               rec(i + 1);
               lvars.delete(lvar);
            }
         })(0);
      }
      else {
         for (let subgoal of goal.subgoals) {
            walk(subgoal);
         }
      }
   })(rootGoal);

   return lvar2ff;
}
relGoalFulfillments ::= function* (goal) {
   $.assert(() => goal.class === $.clsRelGoal);

   if (goal.rkeyBound !== undefined) {
      yield [
         {
            join: $.clsJoinAll,
            fitness: $.Fitness.all,
         },
         []
      ];
      return;
   }

   if (goal.rkeyLvar !== null) {
      yield [
         {
            join: $.clsJoinRecKey,
            fitness: $.Fitness.uniqueHit,
            props: {
               rkeyLvar: goal.rkeyLvar
            }
         },
         [goal.rkeyLvar]
      ];
   }

   let {rel, firmBindings, looseBindings} = goal;
   let indices = rel.class === $.clsBaseRelation ?
      Array.from(rel.indices, ({index}) => index) :
      rel.indices;

   if ($.any(indices, index => $.isFullyCoveredBy(index, Object.keys(firmBindings)))) {
      yield [
         {
            join: $.clsJoinAll,
            fitness: $.Fitness.all,
         },
         []
      ];
      // No need to seek for any other index hits once we have at least one fully
      // covered by firm bindings
      return;      
   }

   for (let index of indices) {
      index = $.reduceIndex(index, Object.keys(firmBindings));

      $.assert(() => index.length > 0);

      let lvars = [];

      for (let attr of index) {
         if ($.ownPropertyValue(looseBindings, attr) === undefined) {
            break;
         }

         lvars.push(looseBindings[attr]);
         
         yield [
            {
               join: $.clsJoinIndex,
               fitness: $.computeFitness(lvars.length, index),
               props: {
                  index,
                  keys: lvars,
               }
            },
            lvars
         ]
      }
   }
}
computeJoinTreeFrom ::= function (Dgoal, {indexRegistry, pathGoals, goalPaths, lvar2ff}) {
   let boundLvars = new Set;
   let bindStack = [];
   
   function bind(lvar) {
      $.assert(() => !boundLvars.has(lvar));

      boundLvars.add(lvar);
      bindStack.push(lvar);

      let becameReady = [];

      for (let ff of lvar2ff.get(lvar) ?? []) {
         $.assert(() => ff.count > 0);

         ff.count -= 1;

         if (ff.count === 0) {
            becameReady.push(ff);
         }
      }

      return becameReady;
   }

   function unbind() {
      $.assert(() => bindStack.length > 0);

      let lvar = bindStack.pop();
      
      $.assert(() => boundLvars.has(lvar));

      boundLvars.delete(lvar);

      for (let ff of lvar2ff.get(lvar) ?? []) {
         ff.count += 1;
      }
   }

   function makeJoinNode(ff) {
      let {join: cls, goal} = ff;

      if (cls === $.clsJoinAll) {
         return {
            class: cls,
            projNum: goal.projNum,
            ...propsForCheckExtract(goal),
            next: null
         }
      }
      else if (cls === $.clsJoinIndex) {
         let {index, keys} = ff.props;

         return {
            class: cls,
            projNum: goal.projNum,
            indexNum: $.registerGoalIndex(indexRegistry, goal, index),
            indexKeys: keys,
            ...propsForCheckExtract(goal, index),
            next: null
         }
      }
      else if (cls === $.clsJoinRecKey) {
         let {rkeyLvar} = ff.props;

         return {
            class: cls,
            projNum: goal.projNum,
            rkeyLvar: rkeyLvar,
            ...propsForCheckExtract(goal),
            next: null
         }
      }
      else if (cls === $.clsJoinFunc) {
         throw new Error;

         let {rel} = goal;

         for (let [attr, char] of $.zip(rel.attrs, ff.icode)) {
            if (char === '-' && goal.looseAttrs.has(attr)) {
               let lvar = goal.looseAttrs.get(attr);
               $.check(!boundLvars.has(lvar), () =>
                  `Functional relation '${rel.name}': instantiation '${ff.icode}' ` +
                  `was found as the best match but the attribute '${attr}' is bound`
               );
            }
         }

         let args = Array.from($.zip(rel.attrs, ff.icode), ([attr, char]) => {
            if (char === '-' || goal.looseAttrs.has(attr)) {
               return {
                  lvar: goal.looseAttrs.get(attr),
                  isBound: char === '+'
               }
            }
            else {
               let firmValue = goal.firmAttrs[attr];

               return {
                  getValue(boundAttrs) {
                     return firmValue
                  }
               }
            }
         });

         return {
            type: $.JoinType.func,
            args,
            icode: ff.icode,
            run: rel.instantiations[ff.icode].run,
            rel,
            next: null,
         }
      }
      else {
         throw new Error;
      }
   }

   function propsForCheckExtract(goal, noCheck=[]) {
      return {
         checkAttrs:
            Array.from(
               $.mapfilter(Object.entries(goal.looseBindings), ([attr, lvar]) => {
                  if (boundLvars.has(lvar) && !noCheck.includes(attr)) {
                     return [attr, lvar];
                  }
               })
            ),
         extractAttrs:
            Array.from(
               $.mapfilter(Object.entries(goal.looseBindings), ([attr, lvar]) => {
                  if (!boundLvars.has(lvar)) {
                     return [attr, lvar];
                  }
               })
            ),
         extractRkeyInto: goal.rkeyLvar !== null && !boundLvars.has(goal.rkeyLvar) ?
            goal.rkeyLvar : null
      }
   }

   function lyingOnPaths(paths1, goals, fulfillments) {
      let goals1 = $.setInter(
         goals, $.concat($.map(paths1, path => pathGoals.get(path)))
      );
      let fulfillments1 = new Set($.filter(fulfillments, ff => goals1.has(ff.goal)))

      return [goals1, fulfillments1];
   }

   function withStackPreserved(callback) {
      return function () {
         let n = bindStack.length;
         let res = callback.apply(this, arguments);

         while (bindStack.length > n) {
            unbind();
         }

         return res;
      };
   }

   let buildTree = withStackPreserved(function (paths, goals, readyFFs, goal0) {
      $.assert(() => goals.has(goal0));

      function bindLvar(lvar) {
         let becameReady = bind(lvar);

         for (let ff of becameReady) {
            if (goals.has(ff.goal)) {
               readyFFs.add(ff);
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

         for (let ff of readyFFs) {
            if (ff.goal === goal) {
               readyFFs.delete(ff);
            }
         }
      }

      function findBestFF() {
         if (readyFFs.size === 0) {
            return null;
         }

         return $.reduce(readyFFs, (ff1, ff2) => {
            if (ff1.fitness > ff2.fitness) {
               return ff1;
            }
            else if (ff2.fitness > ff1.fitness) {
               return ff2;
            }
            // else if (
            //       ff1.type === $.JoinType.funcMany && ff2.type === $.JoinType.funcMany &&
            //       ff1.goal === ff2.goal) {
            //    if ($.isInstantiationCodeMoreSpecialized(ff1.icode, ff2.icode)) {
            //       return ff1;
            //    }
            //    else if ($.isInstantiationCodeMoreSpecialized(ff2.icode, ff1.icode)) {
            //       return ff2;
            //    }
            // }
            
            if (isGoalFull(ff1.goal)) {
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
         let ff = findBestFF();

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
         class: $.clsJoinEither,
         branches: []
      };

      while (true) {
         let jgoal = branchFF.goal;

         let branchPaths = $.setInter(paths, goalPaths.get(jgoal));
         let [branchGoals, branchFFs] = lyingOnPaths(branchPaths, goals, readyFFs);

         let node0 = makeJoinNode(branchFF);
         node0.next = buildTree(branchPaths, branchGoals, branchFFs, jgoal);
         eitherNode.branches.push(node0);

         paths = $.setDiff(paths, goalPaths.get(jgoal));
         [goals, readyFFs] = lyingOnPaths(paths, goals, readyFFs);

         if (goals.size === 0) {
            break;
         }

         branchFF = findBestFF();

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

   let paths0 = new Set(goalPaths.get(Dgoal));
   let [goals0, readyFFs0] = lyingOnPaths(
      paths0,
      goalPaths.keys(),
      lvar2ff.get(true) ?? new Set
   );
   
   return buildTree(paths0, goals0, readyFFs0, Dgoal);
}
isInstantiationCodeMoreSpecialized ::= function (icodeS, icodeG) {
   $.assert(() => icodeS.length === icodeG.length);

   return $.all($.zip(icodeS, icodeG), ([s, g]) => s === '+' || g === '-');
}
makeIndexRegistry ::= function () {
   return [];
}
registerGoalIndex ::= function (registry, goal, index) {
   return $.registerProjNumIndex(registry, goal.projNum, index);
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
   throw new Error;
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
   throw new Error;
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

      if (jnode.type === $.JoinType.func) {
         let {args} = jnode;
         let n_args = [], idxAdditionallyBound = [];

         for (let [i, arg] of $.enumerate(args)) {
            if ($.hasOwnProperty(arg, 'getValue')) {
               n_args.push(arg);
               continue;
            }

            let {lvar, isBound} = arg;

            if (!bindList.includes(lvar)) {
               n_args.push(arg);
               continue;
            }

            n_args.push({
               getValue(boundAttrs) {
                  return boundAttrs[lvar];
               }
            });

            if (!isBound) {
               idxAdditionallyBound.push(i);
            }
         }

         let n_icode = jnode.icode;

         if (idxAdditionallyBound.length > 0) {
            let arr = Array.from(jnode.icode);
            for (let idx of idxAdditionallyBound) {
               arr[idx] = '+';
            }

            n_icode = arr.join('');

            $.check($.hasOwnProperty(jnode.rel.instantiations, n_icode), () =>
               `Narrowing impossible: instantiation '${n_icode}' in '${jnode.rel.name}'` +
               ` is unavailable`
            );
         }

         return {
            type: $.JoinType.func,
            args: n_args,
            icode: n_icode,
            run: jnode.rel.instantiations[n_icode].run,
            rel: jnode.rel,
            next: narrow(jnode.next)
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
         startAttrs: $.narrowAttrList(startAttrs, bindList),
         joinTree: narrow(joinTree)
      })),
      appliedIndices: indexRegistry
   }
}
narrowAttrList ::= function (attrList, bindList) {
   return attrList.filter(([attr, lvar]) => !bindList.includes(lvar));
}
