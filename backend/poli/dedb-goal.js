common
   all
   arrayify
   arrayChain
   assert
   check
   filter
   firstDuplicate
   hasOwnProperty
   isA
   mapfilter
   notAny
   ownEntries
   isObjectWithOwnProperty
   setsEqual
   singleQuoteJoinComma
dedb-index
   reduceIndex
   copyIndex
dedb-rec-key
   recKey
   recVal
dedb-relation
   clsRelation
   toRelation
set-map
   * as: set
-----
clsAndGoal ::= ({
   name: 'goal.and',
   'goal': true,
   'goal.and': true
})
clsOrGoal ::= ({
   name: 'goal.or',
   'goal': true,
   'goal.or': true
})
clsRelGoal ::= ({
   name: 'goal.rel',
   'goal': true,
   'goal.rel': true
})
clsFuncGoal ::= ({
   name: 'goal.func',
   'goal': true,
   'goal.func': true
})
and ::= function (...subgoals) {
   let conjuncts = [];

   for (let subgoal of subgoals) {
      if (subgoal.class === $.clsAndGoal) {
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
      class: $.clsAndGoal,
      subgoals: conjuncts,
   };
}
or ::= function (...subgoals) {
   let disjuncts = [];

   for (let subgoal of subgoals) {
      if (subgoal.class === $.clsOrGoal) {
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
      class: $.clsOrGoal,
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
join ::= function (relInfo, rkey, bindings) {
   let rel = $.toRelation(relInfo);

   if (arguments.length === 2) {
      bindings = rkey;
      rkey = undefined;
   }

   $.check(rkey === undefined || rel.virtualAttrs.includes($.recKey), () =>
      `Cannot grab the rec key of relation '${rel.name}': makes no sense`
   );

   if ($.isLvar(bindings)) {
      $.check(rel.class === $.clsDerivedRelation && rel.isKeyed, () =>
         `Cannot grab the rec val of relation '${rel.name}': makes no sense`
      )
   }

   let firmBindings = $.computeFirmBindings(rkey, bindings);
   let looseBindings = $.computeLooseBindings(rkey, bindings);
   
   {
      let vars = Array.from(Reflect.ownKeys(looseBindings), a => looseBindings[a]);

      let dupVar = $.firstDuplicate(vars);

      $.check(dupVar === undefined, () =>
         `Duplicate variable '${String(dupVar)}' in the goal for '${rel.name}'`
      );
   }

   return {
      class: $.clsRelGoal,
      rel,
      firmBindings,
      looseBindings,
      projNum: -1,
      depNum: -1,
   }
}
goalLvars ::= function (goal) {
   let {looseBindings} = goal;

   return Array.from(Reflect.ownKeys(looseBindings), a => looseBindings[a]);
}
funcGoal ::= function (rel, attrs) {
   throw new Error;

   $.check(rel.type === $.RelationType.functional);

   $.check($.all(Reflect.ownKeys(attrs), a => rel.attrs.includes(a)), () =>
      `Invalid attr(s) in the goal for '${rel.name}'`
   );

   $.check($.all(rel.attrs, a => $.hasOwnProperty(attrs, a)), () =>
      `Not all attrs were supplied in the goal for '${rel.name}'`
   );

   let [firmAttrs, looseAttrs] = $.computeFirmAndLooseBindings(attrs);

   $.check(looseAttrs.size > 0, () => `No vars used in the goal for '${rel.name}'`);

   return {
      type: $.GoalType.func,
      rel: rel,
      firmAttrs,
      looseAttrs
   }
}
computeFirmBindings ::= function (rkey, bindings) {
   let firms = $.isLvar(bindings) ? {} :
      Object.fromEntries(
         $.mapfilter(Object.entries(bindings), ([a, val]) => {
            if (val !== undefined && !$.isLvar(val)) {
               return [a, val];
            }
         })
      );

   if (rkey !== undefined && !$.isLvar(rkey)) {
      firms[$.recKey] = rkey;
   }

   return firms;
}
computeLooseBindings ::= function (rkey, bindings) {
   let loose;

   if ($.isLvar(bindings)) {
      loose = {
         [$.recVal]: bindings[$.lvarSym]
      }
   }
   else {
      loose = Object.fromEntries(
         $.mapfilter(Object.entries(bindings), ([a, lvar]) => {
            if ($.isLvar(lvar)) {
               return [a, lvar[$.lvarSym]];
            }
         })
      );
   }

   if ($.isLvar(rkey)) {
      loose[$.recKey] = rkey[$.lvarSym];
   }
   
   return loose;
}
isLeafGoal ::= function (goal) {
   return goal.class === $.clsRelGoal || goal.class === $.clsFuncGoal;
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
   return $.filter($.leafGoalsBeneath(root), leaf => leaf.class === $.clsRelGoal);
}
walkPaths ::= function (rootGoal, {onLeaf, onPath}) {
   (function walk(goal, K) {
      if ($.isLeafGoal(goal)) {
         onLeaf(goal, K);
      }
      else if (goal.class === $.clsAndGoal) {
         (function rec(chain) {
            if (chain === null) {
               K();
            }
            else {
               walk(chain.item, () => rec(chain.next()));
            }
         })($.arrayChain(goal.subgoals));
      }
      else if (goal.class === $.clsOrGoal) {
         for (let disjunct of goal.subgoals) {
            walk(disjunct, K);
         }
      }
      else {
         throw new Error;
      }
   })(rootGoal, onPath);
}
checkVarUsageAndReturnVars ::= function (rootGoal, outVars) {
   let usageCount = new Map;

   function inc(lvar) {
      usageCount.set(lvar, (usageCount.get(lvar) ?? 0) + 1);
   }

   function dec(lvar) {
      usageCount.set(lvar, usageCount.get(lvar) - 1);
   }

   $.walkPaths(rootGoal, {
      onLeaf: (goal, K) => {
         for (let lvar of $.goalLvars(goal)) {
            inc(lvar);
         }

         K();

         for (let lvar of $.goalLvars(goal)) {
            dec(lvar);
         }
      },
      onPath: () => {
         for (let lvar of outVars) {
            $.check(usageCount.get(lvar) > 0, () =>
               `Attribute '${String(lvar)}': variable misuse`
            );
         }

         for (let [lvar, count] of usageCount) {
            if (count === 1) {
               $.check(outVars.includes(lvar), () =>
                  `Variable '${String(lvar)}' is only mentioned once`
               );
            }
         }
      }
   });

   return Array.from(usageCount.keys());
}
numberRelGoals ::= function (rootGoal) {
   $.assignProjNumToRelGoals(rootGoal);
   $.assignDepNumToRelGoals(rootGoal);
}
assignProjNumToRelGoals ::= function (rootGoal) {
   let num = 0;

   for (let goal of $.relGoalsBeneath(rootGoal)) {
      goal.projNum = num;
      num += 1;
   }

   return num;
}
assignDepNumToRelGoals ::= function (rootGoal) {
   let num = 0;

   (function rec(goal) {
      if (goal.class === $.clsRelGoal) {
         $.assert(() => goal.depNum === -1);

         goal.depNum = num;
         num += 1;
      }
      else if (goal.class === $.clsAndGoal) {
         for (let subgoal of goal.subgoals) {
            rec(subgoal);
         }
      }
      else if (goal.class === $.clsOrGoal) {
         let num0 = num;
         let biggestNum = -1;

         for (let subgoal of goal.subgoals) {
            num = num0;
            rec(subgoal);
            biggestNum = Math.max(biggestNum, num);
         }

         num = biggestNum;
      }
   })(rootGoal);

   return num;
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
