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
dedb-common
   RelationType
data-structures
   BidiMap
dedb-index
   reduceIndex
   isIndexCovered
   copyIndex
   wouldIndexBeCoveredBy
dedb-rec-key
   recKey
   recVal
set-operation
   * as: set
-----
GoalType ::= ({
   and: 'and',
   or: 'or',
   rel: 'rel',
   func: 'func'
})
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
relGoal ::= function (rel, attrs) {
   $.check(rel.type === $.RelationType.base || rel.type === $.RelationType.derived);

   $.check($.all(Reflect.ownKeys(attrs), a => rel.attrs.includes(a)),
      () => `Invalid attr(s) in the goal for '${rel.name}'`
   );

   let [firmAttrs, looseAttrs] = $.computeFirmAndLooseAttrs(attrs);

   {
      let dupVar = $.firstDuplicate(looseAttrs.values());

      $.check(dupVar === undefined, () =>
         `Duplicate lvar '${dupVar}' in the goal for '${rel.name}'`
      );
   }

   let indices = Array.from(
      rel.indices,
      idx => $.reduceIndex(idx, Reflect.ownKeys(firmAttrs))
   );
   let shrunk = indices.reduce((M, idx) => Math.max(M, $.indexShrunk(idx)), $.Shrunk.min);
   let eligibleIndices;

   // There is no point in indexing a scalar projection. In other cases, we still need
   // to consider all eligible indices.
   if (shrunk === $.Shrunk.one) {
      eligibleIndices = [];
   }
   else {
      eligibleIndices = indices
         .filter(idx => !$.isIndexCovered(idx))
         .filter(idx => $.wouldIndexBeCoveredBy(idx, looseAttrs.keys()));
   }

   return {
      type: $.GoalType.rel,
      rel,
      firmAttrs,
      looseAttrs,
      indices: eligibleIndices,
      shrunk: shrunk,
      num: -1
   }
}
goalLvars ::= function (goal) {
   return goal.looseAttrs.values();
}
funcGoal ::= function (rel, attrs) {
   $.check(rel.type === $.RelationType.functional);

   $.check($.all(Reflect.ownKeys(attrs), a => rel.attrs.includes(a)), () =>
      `Invalid attr(s) in the goal for '${rel.name}'`
   );

   $.check($.all(rel.attrs, a => $.hasOwnProperty(attrs, a)), () =>
      `Not all attrs were supplied in the goal for '${rel.name}'`
   );

   let [firmAttrs, looseAttrs] = $.computeFirmAndLooseAttrs(attrs);

   $.check(looseAttrs.size > 0, () => `No lvars used in the goal for '${rel.name}'`);

   return {
      type: $.GoalType.func,
      rel: rel,
      firmAttrs,
      looseAttrs
   }
}
computeFirmAndLooseAttrs ::= function (attrs) {
   let firmAttrs = Object.fromEntries(
      $.mapfilter($.ownEntries(attrs), ([a, val]) => {
         if (!$.isLvar(val)) {
            return [a, val];
         }
      })
   );
   let looseAttrs = new Map(
      $.mapfilter($.ownEntries(attrs), ([a, lvar]) => {
         if ($.isLvar(lvar)) {
            return [a, lvar[$.lvarSym]];
         }
      })
   );

   return [firmAttrs, looseAttrs];
}
checkVarUsage ::= function (rootGoal, attrs) {
   let usageCount = new Map;

   function walk(goal, K) {
      if (goal.type === $.GoalType.rel || goal.type === $.GoalType.func) {
         for (let lvar of $.goalLvars(goal)) {
            usageCount.set(lvar, (usageCount.get(lvar) ?? 0) + 1);
         }

         K();

         for (let lvar of $.goalLvars(goal)) {
            usageCount.set(lvar, usageCount.get(lvar) - 1);
         }
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
   }

   walk(rootGoal, () => {
      for (let attr of attrs) {
         $.check(usageCount.get(attr) >= 1, () => `Attribute '${attr}': variable misuse`);
      }

      for (let [lvar, count] of usageCount) {
         $.check(count !== 1 || attrs.includes(lvar), () =>
            `Lvar '${lvar}' is not used`
         );
      }
   });

   return Array.from(usageCount.keys());
}
walkRelGoals ::= function* walk(goal) {
   if (goal.type === $.GoalType.rel) {
      yield goal;
   }
   else if (goal.type === $.GoalType.and || goal.type === $.GoalType.or) {
      for (let subgoal of goal.subgoals) {
         yield* walk(subgoal);
      }
   }
}
numberRelGoals ::= function (rootGoal) {
   let num = 0;

   for (let goal of $.walkRelGoals(rootGoal)) {
      goal.num = num;
      num += 1;
   }
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
