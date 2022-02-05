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
set-map
   intersection
   difference
   intersect
   purgeSet
dedb-rec-key
   recKey
   recVal
dedb-goal
   walkPaths
   clsRelGoal
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
dedb-derived
   clsDerivedRelation
dedb-projection
   projectionFor
-----
visualizeIncrementalUpdateScheme ::= function* (rel) {
   // function* gen(jnode) {
   //    yield `D(${dconj.rel.name})`;
   //    for (let link of jpath) {
   //       yield ` -> ${link.conj.rel.name}(${link.index.join(', ')})`;
   //       if (link.toCheck.length > 0) {
   //          yield ` checking (${link.toCheck.join(', ')})`;
   //       }
   //       if (link.toExtract.length > 0) {
   //          yield ` getting (${link.toExtract.join(', ')})`;
   //       }
   //    }
   //    yield '\n';
   // }

   // for (let num = 0; num < rel.numProjs; num += 1) {
   //    yield `D(${rel.subInfos[num].rel.name}):`;

   //    yield* (function* rec(jnode) {
   //       let subInfo = rel.subInfos[jnode.projNum];

   //       if (jnode.class === $.clsJoinAll) {
   //          yield ` <-> ${subInfo.rel.name}(*)`;
   //       }
   //       else if (jnode.class === $.clsJoinIndex) {
   //          let {indexNum, indexKeys} = jnode;
   //          let index = idxReg[indexNum];
   //          yield ` <-> ${subInfo.rel.name}(${})`;
   //       }
   //    })();

   //    for (let jnode of config.plans[num].)
   //    let dconj = rel.config0.conjs[num];

   //    console.log(Array.from(gen(dconj, jpath)).join(''));
   // }
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
makeConfig ::= function (rel, boundAttrs) {
   function isNotBound(v) {
      return !boundAttrs.includes(v);
   }

   let idxReg = [];
   let vpool = new $.AnonymousVarPool();
   let fullJoinTree = [], partialJoinTree = [];

   for (let {goal} of rel.subStateful) {
      let [jnodeFull, jnodePartial] = $.computeJoinTreeFrom(
         rel, boundAttrs, goal, idxReg, vpool
      );

      fullJoinTree.push(jnodeFull);
      partialJoinTree.push(jnodePartial);
   }

   let vars = rel.vars.filter(isNotBound).concat(vpool.vars);

   if (vpool.dumbVarCreated) {
      vars.push($.dumbVar);
   }

   return {
      attrs: rel.attrs.filter(isNotBound),
      // bound logAttrs that are non-evaporatable
      nonEvaporated: rel.logAttrs.filter(
         a => boundAttrs.includes(a) && rel.nonEvaporatables.has(a)
      ),
      // array of vars -- variables used in computations. Does not include non-evaporated
      // and firm vars
      vars: vars,
      idxReg,
      fullJoinTree,
      partialJoinTree,
   };
}
computeJoinTreeFrom ::= function (rel, boundAttrs, Dgoal, idxReg, vpool) {
   // Remember that here 'goal' is just a number
   let {path2goals, goal2paths, var2ff, subGoals} = rel;
   let boundVars = new Set;
   let boundStack = [];
   
   function bind(lvar) {
      $.assert(() => !boundVars.has(lvar));

      boundVars.add(lvar);
      boundStack.push(lvar);

      let becameReady = [];

      for (let ff of var2ff.get(lvar) ?? []) {
         $.assert(() => ff.count > 0);

         ff.count -= 1;

         if (ff.count === 0) {
            becameReady.push(ff);
         }
      }

      return becameReady;
   }

   function unbind() {
      let lvar = boundStack.pop();
      
      $.assert(() => boundVars.has(lvar));

      boundVars.delete(lvar);

      for (let ff of var2ff.get(lvar) ?? []) {
         ff.count += 1;
      }
   }

   function makeJoinNode(ff) {
      let {join: cls, goal} = ff;

      if (cls === $.clsJoinFunc) {
         let {run, fetched} = ff.props;
         let {rel, bindings} = subGoals[goal];

         let args = [];
         let toCheck = [];

         vpool.reset();

         for (let attr of rel.attrs) {
            if (!bindings.has(attr)) {
               args.push(vpool.getDumbVar());
               continue;
            }

            let lvar = bindings.get(attr);

            if (fetched.includes(attr) && boundVars.has(lvar)) {
               let temp = vpool.getVar();

               args.push(temp);
               toCheck.push([temp, lvar]);
            }
            else {
               args.push(lvar);
            }
         }

         return {
            class: $.clsJoinFunc,
            run,
            args,
            toCheck,
            next: null,
         }
      }

      let {subNum, rel: grel} = subGoals[goal];

      $.assert(() => subNum !== -1);

      let isDerived = grel.class === $.clsDerivedRelation;

      if (cls === $.clsJoinIndex) {
         let {index, keys} = ff.props;

         if (isDerived) {
            let rindex = [], rkeys = [];

            for (let [attr, lvar] of $.zip(index, keys)) {
               if (!isDeadBound(lvar)) {
                  rindex.push(attr);
                  rkeys.push(lvar);
               }
            }

            if (rindex.length === 0) {
               return {
                  class: $.clsJoinAll,
                  subNum,
                  ...propsForCheckExtract(goal),
                  next: null
               }
            }
            
            index = rindex;
            keys = rkeys;
         }

         return {
            class: $.clsJoinIndex,
            subNum,
            indexNum: $.registerIndex(idxReg, subNum, index),
            indexKeys: keys,
            ...propsForCheckExtract(goal, keys),
            next: null
         }
      }
      
      if (cls === $.clsJoinRecKey) {
         let {rkeyVar} = ff.props;

         if (isDerived && isDeadBound(rkeyVar)) {
            return {
               class: $.clsJoinAll,
               subNum,
               ...propsForCheckExtract(goal),
               next: null
            }
         }
         else {
            return {
               class: $.clsJoinRecKey,
               subNum,
               rkeyVar,
               ...propsForCheckExtract(goal),
               next: null
            }
         }
      }
      
      throw new Error;
   }

   function isDeadBound(lvar) {
      return (
         rel.firmVarBindings.has(lvar) ||
         rel.fictitiousVars.has(lvar) ||
         boundAttrs.includes(lvar)
      )
   }

   function propsForCheckExtract(goal, noCheck=[]) {
      let {bindings, rel: grel} = subGoals[goal];
      let isDerived = grel.class === $.clsDerivedRelation;

      let toCheck = [];
      let toExtract = [];
      let rkeyExtract = null;
      let rvalExtract = null;
      let rvalCheck = null;

      for (let [attr, lvar] of bindings) {
         if (isDerived && isDeadBound(lvar)) {
            continue;
         }

         if (attr === $.recKey) {
            if (boundVars.has(lvar)) {
               // Nothing to do here as bound recKey should've been used for clsJoinRecKey
            }
            else {
               rkeyExtract = lvar;
            }
         }
         else if (attr === $.recVal) {
            if (boundVars.has(lvar)) {
               rvalCheck = lvar;
            }
            else {
               rvalExtract = lvar;
            }
         }
         else if (boundVars.has(lvar)) {
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

   function forkToPaths(paths, goals, ffs) {
      let goalsX = $.intersection(
         goals,
         $.concat($.map(paths, path => path2goals.get(path)))
      );
      let ffsX = new Set($.filter(ffs, ff => goalsX.has(ff.goal)));

      return [goalsX, ffsX];
   }

   function pruneToPaths(paths, goals, ffs) {
      // Same as 'forkToPaths' but modifies goals and ffs in-place
      $.intersect(goals, $.concat($.map(paths, path => path2goals.get(path))));
      $.purgeSet(ffs, ff => goals.has(ff.goal));
   }

   function unwindingStack(callback) {
      let n = boundStack.length;
      
      try {
         return callback();
      }
      finally {
         while (boundStack.length > n) {
            unbind();
         }
      }
   }

   function bindVar(lvar, goals, readyFFs) {
      let becameReady = bind(lvar);

      for (let ff of becameReady) {
         if (goals.has(ff.goal)) {
            readyFFs.add(ff);
         }
      }
   }

   function joinGoal(goal, goals, readyFFs) {
      for (let lvar of subGoals[goal].bindings.values()) {
         if (!boundVars.has(lvar)) {
            bindVar(lvar, goals, readyFFs);
         }
      }

      goals.delete(goal);

      for (let ff of readyFFs) {
         if (ff.goal === goal) {
            readyFFs.delete(ff);
         }
      }
   }

   function buildTree(paths, goals, readyFFs) {
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
         return $.isSubset(paths, goal2paths.get(goal));
      }

      let jnodeHead = null, jnodeTail = null;
      let ffB = null;

      while (goals.size > 0) {
         let ff = findBestFF();

         if (ff === null) {
            throw new Error(`Cannot join!`);
         }

         let jGoal = ff.goal;

         if (!isGoalFull(jGoal)) {
            ffB = ff;
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
         
         joinGoal(jGoal, goals, readyFFs);
      }

      if (ffB === null) {
         // All have been processed in a single branch
         return jnodeHead;
      }

      // Branching
      let eitherNode = {
         class: $.clsJoinEither,
         branches: []
      };

      while (true) {
         let goalB = ffB.goal;

         let pathsB = $.intersection(paths, goal2paths.get(goalB));
         let [goalsB, readyFFsB] = forkToPaths(pathsB, goals, readyFFs);

         let nodeB = makeJoinNode(ffB);
         nodeB.next = unwindingStack(() => {
            joinGoal(goalB, goalsB, readyFFsB);
            return buildTree(pathsB, goalsB, readyFFsB);
         });
         eitherNode.branches.push(nodeB);

         paths = $.difference(paths, pathsB);
         pruneToPaths(paths, goals, readyFFs);

         if (goals.size === 0) {
            break;
         }

         ffB = findBestFF();

         if (ffB === null) {
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
   }

   // Prepare data structures for the start-off run
   let paths = goal2paths.get(Dgoal);
   let goals = new Set($.indexRange(subGoals));
   let readyFFs = new Set(var2ff.get(true) ?? []);

   pruneToPaths(paths, goals, readyFFs);

   return unwindingStack(() => {
      // Bind firm variables and bound attrs
      for (let lvar of $.concat([
               rel.firmVarBindings.keys(), 
               rel.fictitiousVars,
               boundAttrs])) {
         bindVar(lvar, goals, readyFFs);
      }

      let {subNum: DsubNum, rel: Drel} = subGoals[Dgoal];
      let DjnodeFull, DjnodePartial;

      if (Drel.class === $.clsDerivedRelation) {
         DjnodeFull = DjnodePartial = {
            class: $.clsJoinAll,
            subNum: DsubNum,
            ...propsForCheckExtract(Dgoal),
            next: null
         };
      }
      else if (Drel.class === $.clsBaseRelation) {
         DjnodePartial = {
            class: $.clsJoinAll,
            subNum: DsubNum,
            ...propsForCheckExtract(Dgoal),
            // projection has already taken care about filtering out these
            toCheck: [],
            rvalCheck: null,
            next: null,
         };

         let DreadyFFs = Array.from($.filter(readyFFs, ff => ff.goal === Dgoal));

         if (DreadyFFs.length === 0) {
            // Means we should take it fully
            DjnodeFull = {
               class: $.clsJoinAll,
               subNum: DsubNum,
               ...propsForCheckExtract(Dgoal),
               next: null
            };
         }
         else {
            let [ff] = $.greatestBy(DreadyFFs, ff => ff.fitness);

            DjnodeFull = makeJoinNode(ff);
         }
      }
      else {
         throw new Error;
      }

      joinGoal(Dgoal, goals, readyFFs);
      DjnodeFull.next = DjnodePartial.next = buildTree(paths, goals, readyFFs);      

      return [DjnodeFull, DjnodePartial];
   });
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
AnonymousVarPool ::= class {
   constructor() {
      this.vars = [];
      this.idx = 0;
      this.dumbVarCreated = false;
   }

   getVar() {
      let lvar;

      if (this.idx < this.vars.length) {
         lvar = this.vars[this.idx];
      }
      else {
         lvar = `--anon-${this.idx}`;
         this.vars.push(lvar);
      }

      this.idx += 1;

      return lvar;      
   }

   getDumbVar() {
      this.dumbVarCreated = true;
      return $.dumbVar;
   }

   reset() {
      this.idx = 0;
   }
}
dumbVar ::= '--dumb'