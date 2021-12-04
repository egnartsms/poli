common
   all
   arrayify
   arrayChain
   assert
   check
   filter
   firstDuplicate
   hasOwnProperty
   mapfilter
   notAny
   ownEntries
   isObjectWithOwnProperty
   setsEqual
   singleQuoteJoinComma
dedb-index
   reduceIndex
   isIndexCovered
   copyIndex
dedb-rec-key
   recKey
   recVal
set-map
   * as: set
-----
GoalType ::= ({
   and: 'and',
   or: 'or',
   rel: 'rel',
   func: 'func'
})
isLeafGoal ::= function (goal) {
   return goal.type === $.GoalType.rel || goal.type === $.GoalType.func;
}
and ::= function (...subgoals) {
   let conjuncts = [];

   for (let subgoal of subgoals) {
      if (subgoal.type === $.GoalType.and) {
         conjuncts.splice(conjuncts.length, 0, ...subgoal.subgoals);
      }
      else {
         conjuncts.push(subgoal);
      }
   }

   $.check(conjuncts.length > 0, `Empty conjunction`);

   if (conjuncts.length === 1) {
      return conjuncts[0];
   }

   return {
      type: $.GoalType.and,
      subgoals: conjuncts,
   };
}
or ::= function (...subgoals) {
   let disjuncts = [];

   for (let subgoal of subgoals) {
      if (subgoal.type === $.GoalType.or) {
         disjuncts.splice(disjuncts.length, 0, ...subgoal.subgoals);
      }
      else {
         disjuncts.push(subgoal);
      }
   }

   $.check(disjuncts.length > 0, `Empty disjunction`);

   if (disjuncts.length === 1) {
      return disjuncts[0];
   }
   
   return {
      type: $.GoalType.or,
      subgoals: disjuncts,
   };
}
lvarSym ::= Symbol('lvar')
isLvar ::= function (obj) {
   return $.isObjectWithOwnProperty(obj, $.lvarSym);
}
makeLvar ::= function (name) {
   return {
      [$.lvarSym]: name
   }
}
join ::= function (rel, recKey, bindings) {
   $.check(
      rel.type === $.RelationType.base || rel.type === $.RelationType.derived,
      `Expected a (base or derived) relation as argument to join()`
   );

   if (arguments.length === 2) {
      bindings = recKey;
      recKey = null;
   }

   let [firmBindings, looseBindings] = $.computeFirmAndLooseBindings(bindings);

   {
      let dupVar = $.firstDuplicate(Object.values(looseBindings));

      $.check(dupVar === undefined, () =>
         `Duplicate lvar '${dupVar}' in the goal for '${rel.name}'`
      );
   }

   return {
      type: $.GoalType.rel,
      rel,
      recKeyBound: $.isLvar(recKey) ? null : recKey,
      recKeyLvar: $.isLvar(recKey) ? recKey[$.lvarSym] : null,
      firmBindings,
      looseBindings,
      projNum: -1,
      depNum: -1,
   }
}
availableIndices ::= function (rel) {
   if (rel.type === $.RelationType.base) {
      return Array.from(rel.indices, inst => inst.attrs);
   }

   if (rel.type === $.RelationType.derived) {
      return rel.potentialIndices;
   }

   throw new Error;
}
goalLvars ::= function (goal) {
   return Object.values(goal.looseBindings);
}
funcGoal ::= function (rel, attrs) {
   $.check(rel.type === $.RelationType.functional);

   $.check($.all(Reflect.ownKeys(attrs), a => rel.attrs.includes(a)), () =>
      `Invalid attr(s) in the goal for '${rel.name}'`
   );

   $.check($.all(rel.attrs, a => $.hasOwnProperty(attrs, a)), () =>
      `Not all attrs were supplied in the goal for '${rel.name}'`
   );

   let [firmAttrs, looseAttrs] = $.computeFirmAndLooseBindings(attrs);

   $.check(looseAttrs.size > 0, () => `No lvars used in the goal for '${rel.name}'`);

   return {
      type: $.GoalType.func,
      rel: rel,
      firmAttrs,
      looseAttrs
   }
}
computeFirmAndLooseBindings ::= function (bindings) {
   let firmBindings = Object.fromEntries(
      $.mapfilter(Object.entries(bindings), ([a, val]) => {
         if (!$.isLvar(val)) {
            return [a, val];
         }
      })
   );
   let looseBindings = Object.fromEntries(
      $.mapfilter(Object.entries(bindings), ([a, lvar]) => {
         if ($.isLvar(lvar)) {
            return [a, lvar[$.lvarSym]];
         }
      })
   );

   return [firmBindings, looseBindings];
}
leafGoalsBeneath ::= function* gen(root) {
   if ($.isLeafGoal(root)) {
      yield root;
   }
   else {
      for (let subgoal of root.subgoals) {
         yield* gen(subgoal);
      }
   }
}
relGoalsBeneath ::= function (root) {
   return $.filter($.leafGoalsBeneath(root), leaf => leaf.type === $.GoalType.rel);
}
walkPaths ::= function (rootGoal, {onLeaf, onPath}) {
   (function walk(goal, K) {
      if ($.isLeafGoal(goal)) {
         onLeaf(goal, K);
      }
      else if (goal.type === $.GoalType.and) {
         (function rec(chain) {
            if (chain === null) {
               K();
            }
            else {
               walk(chain.item, () => rec(chain.next()));
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
   })(rootGoal, onPath);
}
checkVarUsageAndReturnVars ::= function (rootGoal, attrs) {
   let usageCount = new Map;

   $.walkPaths(rootGoal, {
      onLeaf: (goal, K) => {
         for (let lvar of $.goalLvars(goal)) {
            usageCount.set(lvar, (usageCount.get(lvar) ?? 0) + 1);
         }

         K();

         for (let lvar of $.goalLvars(goal)) {
            usageCount.set(lvar, usageCount.get(lvar) - 1);
         }
      },
      onPath: () => {
         for (let attr of attrs) {
            $.check(usageCount.get(attr) >= 1, () =>
               `Attribute '${attr}': variable misuse`
            );
         }

         for (let [lvar, count] of usageCount) {
            $.check(count !== 1 || attrs.includes(lvar), () =>
               `Lvar '${lvar}' is not used`
            );
         }
      }
   });

   return Array.from(usageCount.keys());
}
numberRelGoals ::= function (rootGoal) {
   $.assignProjNumForRelGoals(rootGoal);
   $.assignDepNumForRelGoals(rootGoal);
}
assignProjNumForRelGoals ::= function (rootGoal) {
   let num = 0;

   for (let goal of $.relGoalsBeneath(rootGoal)) {
      goal.projNum = num;
      num += 1;
   }
}
assignDepNumForRelGoals ::= function (rootGoal) {
   let num = 0;

   (function process(goal) {
      if (goal.type === $.GoalType.rel) {
         $.assert(() => goal.depNum === -1);

         goal.depNum = num;
         num += 1;
      }
      else if (goal.type === $.GoalType.and) {
         for (let subgoal of goal.subgoals) {
            process(subgoal);
         }
      }
      else if (goal.type === $.GoalType.or) {
         let num0 = num;
         let biggestNum = -1;

         for (let subgoal of goal.subgoals) {
            num = num0;
            process(subgoal);
            biggestNum = Math.max(biggestNum, num);
         }

         num = biggestNum;
      }
      else {
         $.assert(() => goal.type === $.GoalType.func);
      }
   })();
}
Shrunk ::= ({
   min: 0,
   all: 0,
   part: 1,
   one: 2,
   max: 2,
})
indexShrunk ::= function (index) {
   return $.isIndexCovered(index) ?
      (index.isUnique ? $.Shrunk.one : $.Shrunk.part) :
      $.Shrunk.all;
}
funcRelShrunk ::= function (rel, firmAttrs) {
   throw new Error;

   let icode = $.instantiationCode(rel, firmAttrs);

   if (!$.hasOwnProperty(rel.instantiations, icode)) {
      return $.Shrunk.all;
   }

   let instantiation = rel.instantiations[icode];

   if ($.hasOwnProperty(instantiation, 'det')) {
      return $.Shrunk.one;
   }
   else if ($.hasOwnProperty(instantiation, 'nondet')) {
      return $.Shrunk.part;
   }
   else {
      throw new Error;
   }
}
instantiationShrunk ::= function (ins) {
   throw new Error;

   if ($.hasOwnProperty(ins, 'det')) {
      return $.Shrunk.one;
   }
   else if ($.hasOwnProperty(ins, 'nondet')) {
      return $.Shrunk.part;
   }
   else {
      throw new Error;
   }
}
instantiationCode ::= function (rel, firmAttrs) {
   throw new Error;

   let codes = new Array(rel.attrs.length);

   for (let attr of rel.attrs) {
      if ($.hasOwnProperty(firmAttrs, attr)) {
         codes.push('+');
      }
      else {
         codes.push('-');
      }
   }

   return codes.join('');
}
