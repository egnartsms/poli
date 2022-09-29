common
   all
   arrayify
   arrayChain
   assert
   check
   chain
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
   isStatefulRelation
set-map
   deleteAll
   addAll
   intersect
   intersection
-----

and ::=
   function (...subgoals) {
      let conjuncts = [];

      for (let subgoal of subgoals) {
         if (subgoal.kind === 'and') {
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
         kind: 'and',
         conjuncts,
      };
   }


or ::=
   function (...subgoals) {
      let disjuncts = [];

      for (let subgoal of subgoals) {
         if (subgoal.kind === 'or') {
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
         kind: 'or',
         disjuncts,
      };
   }


lvarSym ::= Symbol('lvar')


isLvar ::=
   function (obj) {
      return $.isObjectWithOwnProperty(obj, $.lvarSym);
   }


makeLvar ::=
   function (name) {
      return {
         [$.lvarSym]: name
      }
   }


use ::=
   :Make a goal that refers to the given relation (of any kind)

    Can be used in 2 forms:

      - $.use(rel, bindings)

      - $.use(rel, evar, bindings)

        `evar` stands for "entity variable". This is for entity base relations, to get
        a hold of entity itself.

   function (rel, evar, bindings) {
      if (arguments.length === 2) {
         bindings = evar;
         evar = null;
      }

      let firmBindings = new Map(
         $.filter(Object.entries(bindings), ([a, val]) => {
            return val !== undefined && !$.isLvar(val);
         })
      );
      let looseBindings = new Map(
         $.mapfilter(Object.entries(bindings), ([a, lvar]) => {
            if ($.isLvar(lvar)) {
               return [a, lvar[$.lvarSym]];
            }
         })
      );

      {
         let vars = Array.from(looseBindings.values());
         let dupVar = $.firstDuplicate(vars);

         $.check(dupVar === undefined, () =>
            `Duplicate variable '${String(dupVar)}' in the goal for '${rel.name}'`
         );
      }

      return {
         kind: 'rel',
         rel,
         firmBindings,
         looseBindings,
      }
   }


buildGoalTree ::=
   function (root0, attrs) {
      if (root0 instanceof Array) {
         root0 = {
            kind: 'and',
            conjuncts: root0
         }
      }
      else if (root0.kind !== 'and') {
         root0 = {
            kind: 'and',
            conjuncts: [root0]
         }
      }

      let root1 = $.buildTree1(root0);

      $.checkVarUsage(root1, attrs);

      let vars = $.collectLooseVars(root1);
      let varsNE = $.collectNonEvaporatableVars(root1);

      $.intersect(varsNE, attrs);

      let {
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         root: root2,
      } = $.buildTree2(root1, attrs);
      let numDeps = $.setupDepNums(root2);

      return {
         rootGroup: root2,
         goals: Array.from($.relGoalsBeneath(root2)),
         statefulGoals: Array.from($.filter($.relGoalsBeneath(root2), g => g.isStateful)),
         numDeps,
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         attrsNE: varsNE  // non-evaporatable
      }
   }


buildTree1 ::=
   :Convert goal object (as provided by relation definition, see $.or, $.and, $.use)
    to the phase 1 goal node:
    
    * conjunctions discriminate their children as leaves and disjunctions
    
    * all disjuncts are necessarily conjunctions (achieved by wrapping all 'rel' goals in
      singleton conjunctions). This is needed because then we can use conjunction nodes
      directly as branch designators.
    
    * we don't need the 'kind' discriminator any more, so we don't use it
   
   function (root0) {
      function convertRel(goal0) {
         return {
            rel: goal0.rel,
            firmBindings: goal0.firmBindings,
            looseBindings: goal0.looseBindings,
         }
      }

      function convertConj(goal0) {
         let choices = [];
         let leaves = [];

         for (let sub0 of goal0.conjuncts) {
            if (sub0.kind === 'or') {
               choices.push(convertDisj(sub0));
            }
            else if (sub0.kind === 'rel') {
               leaves.push(convertRel(sub0));
            }
            else {
               throw new Error;
            }
         }

         return {
            choices,
            leaves
         }
      }

      function convertDisj(goal0) {
         let alts = [];  // all alternatives (disjuncts) are always conjunctions

         for (let sub0 of goal0.disjuncts) {
            let sub1;

            if (sub0.kind === 'rel') {
               // Wrap it in an 'and'
               sub1 = {
                  choices: [],
                  leaves: [convertRel(sub0)],
               }
            }
            else if (sub0.kind === 'and') {
               sub1 = convertConj(sub0);
            }
            else {
               // 'or' cannot be nested inside another 'or', the $.or itself takes care of
               // that
               throw new Error;
            }

            alts.push(sub1);
         }

         return {
            alts
         }
      }

      $.assert(() => root0.kind === 'and');

      return convertConj(root0);
   }


checkVarUsage ::=
   function (root1, attrs) {
      let {open, closed} = $.openClosedVars(root1);

      for (let lvar of attrs) {
         $.addOpenVar(open, closed, lvar);
      }

      $.check(open.size === 0, () =>
         `Variables mentioned only once: ${$.singleQuoteJoinComma(open)}`
      );
   }


openClosedVars ::=
   function (root1) {
      function groupOC(goal) {
         let subOpen = [], subClosed = [];

         for (let leaf of goal.leaves) {
            subOpen.push(new Set(leaf.looseBindings.values()));
         }

         for (let choice of goal.choices) {
            let {open, closed} = choiceOC(choice);

            subOpen.push(open);
            subClosed.push(closed);
         }

         let closed = new Set($.chain(subClosed));
         let open = new Set;

         for (let lvar of $.chain(subOpen)) {
            $.addOpenVar(open, closed, lvar);
         }

         return {open, closed};
      }

      function choiceOC(goal) {
         let subOpen = [], subClosed = [];

         for (let alt of goal.alts) {
            let {open, closed} = groupOC(alt);

            subOpen.push(open);
            subClosed.push(closed);
         }

         return {
            open: new Set($.chain(subOpen)),
            closed: $.intersection(...subClosed)
         }
      }

      return groupOC(root1);
   }


addOpenVar ::=
   function (open, closed, lvar) {
      if (closed.has(lvar))
         ;
      else if (open.has(lvar)) {
         open.delete(lvar);
         closed.add(lvar);
      }
      else {
         open.add(lvar);
      }
   }


relGoalsBeneath ::=
   function* (root) {
      // Works for both v1 and v2 trees (because the nodes have same props)
      function* fromGroup(group) {
         yield* group.leaves;

         for (let choice of group.choices) {
            yield* fromChoice(choice);
         }
      }

      function* fromChoice(choice) {
         for (let alt of choice.alts) {
            yield* fromGroup(alt);
         }
      }

      yield* fromGroup(root);
   }


collectLooseVars ::=
   function (root1) {
      return Array.from(
         new Set(
            $.chain($.map($.relGoalsBeneath(root1), g => g.looseBindings.values()))
         )
      )
   }


collectNonEvaporatableVars ::=
   function (root1) {
      let varsNE = new Set;

      for (let goal of $.relGoalsBeneath(root1)) {
         if (goal.rel.kind !== 'derived') {
            $.addAll(varsNE, goal.looseBindings.values());
         }
      }

      return varsNE;
   }


buildTree2 ::=
   :Goals and tree v2 differ from those v1 in the following:
      * we introduce firm vars and fictitious vars
      * rel goals have just 'bindings' (rather than 'firmBindings', 'looseBindings')
      * goals know their parents

   function (root1, attrs) {
      let firmVarBindings = new Map;
      let fictitiousVars = new Set;
      let subRoutes = new Map($.map(attrs, a => [a, []]));
      let varNum = 0;
      let subNum = 0;

      function convertRel(goal1, parentGroup) {
         let isDerived = goal1.rel.kind === 'derived';
         let bindings = new Map(goal1.looseBindings);

         for (let [attr, val] of goal1.firmBindings) {
            let lvar = `-firm-${goal1.rel.name}-${varNum}`;
            varNum += 1;

            bindings.set(attr, lvar);

            if (isDerived) {
               fictitiousVars.add(lvar);
            }
            else {
               firmVarBindings.set(lvar, val);
            }
         }

         if ($.isStatefulRelation(goal1.rel)) {
            for (let [attr, lvar] of goal1.looseBindings) {
               if (subRoutes.has(lvar)) {
                  subRoutes.get(lvar).push([subNum, attr]);
               }
            }

            return {
               parentGroup,
               rel: goal1.rel,
               isStateful: true,
               isDerived,
               bindings,
               firm: Object.fromEntries(goal1.firmBindings),
               depNum: -1,  // will be evaluated separately
               subNum: subNum++
            }
         }
         else {
            return {
               parentGroup,
               rel: goal1.rel,
               isStateful: false,
               bindings,
            }
         }
      }

      function convertGroup(goal1, parentChoice) {
         let group = {
            parentChoice,
            leaves: [],
            choices: []
         };

         for (let leaf of goal1.leaves) {
            group.leaves.push(convertRel(leaf, group));
         }

         for (let choice of goal1.choices) {
            group.choices.push(convertChoice(choice, group));
         }

         return group;
      }

      function convertChoice(goal1, parentGroup) {
         let choice = {
            parentGroup,
            alts: []
         }

         for (let alt of goal1.alts) {
            choice.alts.push(convertGroup(alt, choice));
         }

         return choice;
      }

      let root2 = convertGroup(root1, null);

      return {
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         root: root2
      };
   }


setupDepNums ::=
   function (root2) {
      let num = 0;

      function processRel(goal) {
         if (goal.isStateful) {
            goal.depNum = num;
            num += 1;
         }
      }

      function processGroup(goal) {
         for (let leaf of goal.leaves) {
            processRel(leaf);
         }

         for (let choice of goal.choices) {
            processChoice(choice);
         }
      }

      function processChoice(goal) {
         let num0 = num;
         let biggestNum = -1;

         for (let alt of goal.alts) {
            num = num0;
            processGroup(alt);
            biggestNum = Math.max(biggestNum, num);
         }

         num = biggestNum;      
      }

      processGroup(root2);

      return num;
   }
