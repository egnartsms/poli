common
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
data-structures
   BidiMap
prolog-index
   reduceIndex
   isIndexCovered
   copyIndex
   wouldIndexBeCoveredBy
prolog-rec-key
   recKey
   recVal
set-operation
   * as: set
-----
GoalType ::= ({
   and: 'and',
   or: 'or',
   rel: 'rel'
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

   let leaves = conjuncts.filter(g => g.type === $.GoalType.rel);
   let disjunctions = conjuncts.filter(g => g.type === $.GoalType.or);

   let goal = {
      type: $.GoalType.and,
      parent: null,
      subgoals: conjuncts,
      leaves,
      disjunctions,
   };

   for (let subgoal of conjuncts) {
      subgoal.parent = goal;
   }

   return goal;
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
   
   let goal = {
      type: $.GoalType.or,
      parent: null,
      subgoals: disjuncts,
   };

   for (let subgoal of disjuncts) {
      subgoal.parent = goal;
   }

   return goal;
}
lvarSym ::= Symbol('lvar')
isLvar ::= function (obj) {
   return $.isObjectWithOwnProperty(obj, $.lvarSym);
}
relGoal ::= function (rel, attrs) {
   let missingAttrs = Reflect.ownKeys(attrs).filter(a => !rel.attrs.includes(a));

   $.check(missingAttrs.length === 0, () =>
      `Missing attrs in the goal for '${rel.name}': ` +
         `${$.singleQuoteJoinComma(missingAttrs)}`
   );

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

   let dupVar = $.firstDuplicate(looseAttrs.values());

   $.check(dupVar === undefined, () =>
      `Duplicate lvar '${dupVar}' in the goal for '${rel.name}'`
   );

   let indices = Array.from(
      rel.indices,
      idx => $.reduceIndex(idx, Reflect.ownKeys(firmAttrs))
   );
   let shrunk = indices.reduce((M, idx) => Math.max(M, $.indexShrunk(idx)), $.Shrunk.min);
   let eligibleIndices;

   // There is no point in indexing a scalar projection. In other cases, we still need
   // to consider all eligible indices.
   if (shrunk === $.Shrunk.scalar) {
      eligibleIndices = [];
   }
   else {
      eligibleIndices = indices
         .filter(idx => !$.isIndexCovered(idx))
         .filter(idx => $.wouldIndexBeCoveredBy(idx, looseAttrs.keys()));
   }

   return {
      type: $.GoalType.rel,
      parent: null,
      rel,
      firmAttrs,
      looseAttrs,
      indices: eligibleIndices,
      shrunk: shrunk,
      num: -1
   }
}
checkVarUsage ::= function (rootGoal, attrs) {
   let usageCount = new Map;

   function walk(goal, K) {
      if (goal.type === $.GoalType.rel) {
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
   else {
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
   no: 0,
   index: 1,
   scalar: 2,
   max: 2,
})
indexShrunk ::= function (index) {
   return $.isIndexCovered(index) ?
      (index.isUnique ? $.Shrunk.scalar : $.Shrunk.index) :
      $.Shrunk.no;
}
goalLvars ::= function (goal) {
   return goal.looseAttrs.values();
}
reduceConjIndex ::= function (conj, index, boundAttrs) {
   return $.reduceIndex(
      index,
      $.mapfilter(conj.looseAttrs, ([attr, lvar]) => {
         if ($.hasOwnProperty(boundAttrs, lvar)) {
            return attr;
         }
      })
   );
}
reduceConj ::= function (conj, boundAttrs) {
   let newFirms = {...conj.firmAttrs};
   let newLoose = new $.BidiMap(conj.looseAttrs);

   for (let [attr, lvar] of conj.looseAttrs) {
      if ($.hasOwnProperty(boundAttrs, lvar)) {
         newFirms[attr] = boundAttrs[lvar];
         newLoose.delete(attr);
      }
   }

   let newShrunk = conj.shrunk;

   if (newShrunk < $.Shrunk.max) {
      if (conj.rel.keyed !== false && $.hasOwnProperty(boundAttrs, $.recKey)) {
         newShrunk = $.Shrunk.scalar;
      }
      else {
         for (let index of conj.indices) {
            let rshrunk = $.indexShrunk($.reduceConjIndex(conj, index, boundAttrs));

            if (rshrunk > newShrunk) {
               newShrunk = rshrunk;
               if (newShrunk === $.Shrunk.max) {
                  break;
               }
            }
         }   
      }
   }
   
   return {
      rel: conj.rel,
      firmAttrs: newFirms,
      looseAttrs: newLoose,
      // for reduced conjuncts we don't keep 'indices' -- no need to
      shrunk: newShrunk,
      num: conj.num
   }
}
