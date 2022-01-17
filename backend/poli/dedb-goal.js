common
   all
   arrayify
   arrayChain
   assert
   check
   concat
   filter
   firstDuplicate
   hasOwnProperty
   enumerate
   isA
   map
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
   isStatefulRelation
dedb-base
   clsBaseRelation
dedb-derived
   clsDerivedRelation
set-map
   deleteAll
   addAll
   intersect
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

   $.check($.isA(rel, $.clsRelation), `Joining smth which is not a relation`);

   if (arguments.length === 2) {
      bindings = rkey;
      rkey = undefined;
   }

   $.check(rkey === undefined || rel.logAttrs[0] === $.recKey, () =>
      `Cannot grab the rec key of relation '${rel.name}': makes no sense`
   );

   if ($.isLvar(bindings)) {
      $.check(
         rel.class === $.clsBaseRelation && rel.isKeyed ||
            rel.class === $.clsDerivedRelation && rel.isUnwrapped,
         () => `Cannot grab the rec val of relation '${rel.name}': makes no sense`
      )
   }

   let firmBindings = $.computeFirmBindings(rkey, bindings);
   let looseBindings = $.computeLooseBindings(rkey, bindings);
   
   {
      let vars = Array.from(looseBindings.values());
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
      num: -1,
      // for all except derived relations, we introduce firm (fictitious) vars for firm
      // bindings, so 'bindings' would be a union of looseBindings + firmBindings where
      // values get replaced by these fictitious vars. For derived relations,
      // firmBindings completely evaporate.
      ...(rel.class !== $.clsDerivedRelation && {
         bindings: null
      }),
      // following props make sense for only stateful relations
      ...($.isStatefulRelation(rel) && {
         statefulNum: -1,
         depNum: -1,
      }),
      
   }
}
computeFirmBindings ::= function (rkey, bindings) {
   let firms = new Map(
      $.isLvar(bindings) ? [] :
         $.mapfilter(Object.entries(bindings), ([a, val]) => {
            if (val !== undefined && !$.isLvar(val)) {
               return [a, val];
            }
         })
   );

   if (rkey !== undefined && !$.isLvar(rkey)) {
      firms.set($.recKey, rkey);
   }

   return firms;
}
computeLooseBindings ::= function (rkey, bindings) {
   let loose;

   if ($.isLvar(bindings)) {
      loose = new Map([[$.recVal, bindings[$.lvarSym]]]);
   }
   else {
      loose = new Map(
         $.mapfilter(Object.entries(bindings), ([a, lvar]) => {
            if ($.isLvar(lvar)) {
               return [a, lvar[$.lvarSym]];
            }
         })
      );
   }

   if ($.isLvar(rkey)) {
      loose.set($.recKey, rkey[$.lvarSym]);
   }
   
   return loose;
}
relGoalsBeneath ::= function* gen(root) {
   if (root.class === $.clsRelGoal) {
      yield root;
   }
   else {
      for (let subgoal of root.subgoals) {
         yield* gen(subgoal);
      }
   }
}
statefulGoalsBeneath ::= function gen(root) {
   return $.filter($.relGoalsBeneath(root), ({rel}) => $.isStatefulRelation(rel));
}
initGoalTree ::= function (rootGoal, logAttrs) {
   for (let [num, goal] of $.enumerate($.relGoalsBeneath(rootGoal))) {
      goal.num = num;
   }

   for (let [num, goal] of $.enumerate($.statefulGoalsBeneath(rootGoal))) {
      goal.statefulNum = num;
   }

   let numDeps = $.setupDepNums(rootGoal);
   let firmVarBindings = $.setupFirmVars(rootGoal);
   let vars = $.collectVars(rootGoal);
   let nonEvaporatables = $.collectNonEvaporatableVars(rootGoal);

   $.intersect(nonEvaporatables, new Set(logAttrs));

   return {
      numDeps,
      firmVarBindings,
      vars,
      nonEvaporatables
   }
}
walkPaths ::= function (rootGoal, {onLeaf, onPath}) {
   (function walk(goal, K) {
      if (goal.class === $.clsRelGoal) {
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
checkVarUsage ::= function (rootGoal, logAttrs) {
   let usageCount = new Map;

   function inc(lvar) {
      usageCount.set(lvar, (usageCount.get(lvar) ?? 0) + 1);
   }

   function dec(lvar) {
      usageCount.set(lvar, usageCount.get(lvar) - 1);
   }

   $.walkPaths(rootGoal, {
      onLeaf(goal, K) {
         for (let lvar of goal.looseBindings.values()) {
            inc(lvar);
         }

         K();

         for (let lvar of goal.looseBindings.values()) {
            dec(lvar);
         }
      },
      onPath() {
         for (let lvar of logAttrs) {
            $.check(usageCount.get(lvar) > 0, () =>
               `Attribute '${lvar}': variable misuse`
            );
         }

         for (let [lvar, count] of usageCount) {
            if (count === 1) {
               $.check(logAttrs.includes(lvar), () =>
                  `Variable '${lvar}' is only mentioned once`
               );
            }
         }
      }
   });
}
setupDepNums ::= function (rootGoal) {
   let num = 0;

   (function rec(goal) {
      if (goal.class === $.clsRelGoal) {
         if ($.isStatefulRelation(goal.rel)) {
            goal.depNum = num;
            num += 1;   
         }
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
      else {
         throw new Error;
      }
   })(rootGoal);

   return num;
}
collectVars ::= function (rootGoal) {
   return Array.from(
      new Set(
         $.concat($.map($.relGoalsBeneath(rootGoal), g => g.looseBindings.values()))
      )
   );
}
collectNonEvaporatableVars ::= function (rootGoal) {
   let nonEvaporatables = new Set([$.recKey, $.recVal]);

   for (let goal of $.relGoalsBeneath(rootGoal)) {
      if (goal.rel.class !== $.clsDerivedRelation) {
         $.addAll(nonEvaporatables, goal.looseBindings.values());
      }
   }

   return nonEvaporatables;
}
setupFirmVars ::= function (rootGoal) {
   let firmVarBindings = new Map;
   let counter = 0;

   for (let goal of $.relGoalsBeneath(rootGoal)) {
      if (goal.rel.class === $.clsDerivedRelation) {
         continue;
      }

      goal.bindings = new Map(goal.looseBindings);

      for (let [attr, val] of goal.firmBindings) {
         let lvar = `var-${goal.rel.name}-${counter}`;
         counter += 1;
         
         goal.bindings.set(attr, lvar);
         firmVarBindings.set(lvar, val);
      }
   }
   
   return firmVarBindings;
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
