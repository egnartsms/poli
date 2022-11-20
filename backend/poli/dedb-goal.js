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
   isWrappedWith
   wrapWith

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

dedb-base
   entitySym

-----

and ::=
   function (...subgoals) {
      let conjuncts = [];

      for (let subgoal of subgoals) {
         if (subgoal.kind === 'and') {
            conjuncts.splice(conjuncts.length, 0, ...subgoal.conjuncts);
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
            disjuncts.splice(disjuncts.length, 0, ...subgoal.disjuncts);
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


lvarSym ::= Symbol.for('poli.lvar')


makeLvar ::=
   function (name) {
      return $.wrapWith($.lvarSym, name);
   }


isLvar ::=
   function (obj) {
      return $.isWrappedWith($.lvarSym, obj);
   }


use ::=
   :Make a goal that refers to the given relation (of any kind)

    Can be used in 2 forms:

      - $.use(rel, bindings)

      - $.use(rel, entityVar, bindings)

    'entityVar' stands for "entity variable". This is to get a hold of the entity itself. Can be
     provided only if 'rel' is a base entity relation.

   function (rel, bindings) {
      let entityVar = null;

      if (arguments.length === 3) {
         [rel, entityVar, bindings] = arguments;

         $.check($.isEntityRelation(rel), () =>
            `Entity variable only makes sense for entity relations, used for: '${rel.name}'`
         );
         $.check($.isLvar(entityVar), () =>
            `Expected entity variable, got this instead: '${entityVar}'`
         );

         entityVar = entityVar[$.lvarSym];
      }
      else if (arguments.length !== 2) {
         throw new Error(`$.use(): wrong number of arguments`);
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

         if (entityVar !== null) {
            vars.push(entityVar);
         }

         let dupVar = $.firstDuplicate(vars);

         $.check(dupVar === undefined, () =>
            `Duplicate variable '${String(dupVar)}' in the goal for '${rel.name}'`
         );
      }

      return {
         kind: 'rel',
         rel,
         entityVar,
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

      let {
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         numAnonymousIdVars,
         root: root2,
      } = $.buildTree2(root1, attrs);

      let vars = new Set(
         $.concat(
            $.chain($.map($.goalsBeneath(root1), $.goalVars)),
            $.map($.range(numAnonymousIdVars), $.nthIdVar)
         )
      );
      let attrsNE = $.collectNonEvaporatableAttrs(root2, attrs);
      // TODO: this is not implemented
      let idVars = new Set($.idvarsBeneath(root1));
      let outVars = new Set($.concat(attrs, idVars));

      return {
         rootGroup: root2,
         goals: Array.from($.goalsBeneath(root2)),
         statefulGoals: Array.from($.filter($.goalsBeneath(root2), g => g.isStateful)),
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         vars,
         idVars,
         outVars,  // all variables that are copied onto the record being created
         attrsNE  // non-evaporatable
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
            entityVar: goal0.entityVar,
            firmBindings: goal0.firmBindings,
            looseBindings: goal0.looseBindings
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
               throw new Error(`Programming error`);
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
               throw new Error(`Programming error`);
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
            subOpen.push(new Set($.goalVars(leaf)));
         }

         for (let choice of goal.choices) {
            let {open, closed} = choiceOC(choice);

            subOpen.push(open);
            subClosed.push(closed);
         }

         let open = new Set;
         let closed = new Set($.chain(subClosed));

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
            open: new Set($.concat(...subOpen)),
            closed: $.intersection(...subClosed)
         }
      }

      return groupOC(root1);
   }


goalVars ::=
   function* (goal1) {
      yield* goal1.looseBindings.values();

      if (goal1.entityVar !== null) {
         yield goal1.entityVar;
      }
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


goalsBeneath ::=
   :Generate all leaf goals in the given subtree

    Works for both v1 and v2 trees (because the nodes have same props).

   function* (root) {
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


isVarSynthetic ::=
   function (lvar) {
      return lvar.startsWith('-');
   }


collectNonEvaporatableAttrs ::=
   function (root1, attrs) {
      let varsNE = new Set(function* () {
         for (let goal of $.goalsBeneath(root1)) {
            if (goal.rel.kind !== 'derived') {
               yield* $.goalVars(goal)
            }
         }
      }());

      return attrs.filter(attr => varsNE.has(attr));
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
      let nFirmVar = 0;
      let nIdVar = 0;
      let nMaxIdVar = -1;
      let nSub = 0;

      function nextFirmVar(relName) {
         return `-firm-${relName}-${nFirmVar++}`
      }

      function nextIdVar() {
         if (nIdVar > nMaxIdVar) {
            nMaxIdVar = nIdVar;
         }
         
         let lvar = $.nthIdVar(nIdVar);

         nIdVar += 1;

         return lvar;
      }

      function convertRel(goal, parentGroup) {
         let bindings = new Map(goal.looseBindings);

         for (let [attr, val] of goal.firmBindings) {
            let lvar = nextFirmVar(goal.rel.name);

            bindings.set(attr, lvar);

            if (goal.rel.kind === 'derived') {
               fictitiousVars.add(lvar);
            }
            else {
               firmVarBindings.set(lvar, val);
            }
         }

         if ($.isStatefulRelation(goal.rel)) {
            for (let [attr, lvar] of goal.looseBindings) {
               if (subRoutes.has(lvar)) {
                  subRoutes.get(lvar).push([nSub, attr]);
               }
            }

            if (goal.entityVar !== null && subRoutes.has(goal.entityVar)) {
               subRoutes.get(goal.entityVar).push([nSub, $.entitySym]);
            }

            return {
               parentGroup,
               rel: goal.rel,
               isStateful: true,
               bindings,
               idVar: goal.entityVar ?? (goal.rel.kind === 'derived' ? true : nextIdVar()),
               firm: Object.fromEntries(goal.firmBindings),
               nSub: nSub++
            }
         }
         else {
            return {
               parentGroup,
               rel: goal.rel,
               isStateful: false,
               bindings,
            }
         }
      }

      function convertGroup(goal, parentChoice) {
         let group = {
            parentChoice,
            leaves: [],
            choices: []
         };

         for (let leaf of goal.leaves) {
            group.leaves.push(convertRel(leaf, group));
         }

         for (let choice of goal.choices) {
            group.choices.push(convertChoice(choice, group));
         }

         return group;
      }

      function convertChoice(goal, parentGroup) {
         let choice = {
            parentGroup,
            alts: []
         }

         let baseId = nIdVar;
         let maxId = -1;

         for (let alt of goal.alts) {
            nIdVar = baseId;

            choice.alts.push(convertGroup(alt, choice));

            maxId = Math.max(maxId, nIdVar)
         }

         nIdVar = maxId;

         return choice;
      }

      let root2 = convertGroup(root1, null);

      return {
         firmVarBindings,
         fictitiousVars,
         subRoutes,
         numAnonymousIdVars: nMaxIdVar,
         root: root2
      };
   }


nthIdVar ::=
   function (n) {
      return `-id-${n}`;
   }
