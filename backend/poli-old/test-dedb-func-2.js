common
   check
   isLike
   checkLike
dedb-index
   Fitness
dedb-base
   resetFacts
   addFact
   removeFact
   baseRelation
   replaceWhere
dedb-derived
   derivedRelation
dedb-functional
   functionalRelation
dedb-query
   query
   queryAtMostOne
dedb-goal
   use
-----

born ::=
   $.baseRelation({
      name: 'born',
      attrs: ['country', 'born'],
      indices: [['country', 1]]
   })

died ::=
   $.baseRelation({
      name: 'died',
      attrs: ['country', 'died'],
      indices: [['country', 1]]
   })

growth ::=
   $.derivedRelation({
      name: 'growth',
      attrs: ['country', 'growth'],
      body: v => [
         $.use($.born, {country: v`country`, born: v`born`}),
         $.use($.died, {country: v`country`, died: v`died`}),
         $.use($.diff, {op1: v`born`, op2: v`died`, diff: v`growth`})
      ]
   })

diff ::=
   $.functionalRelation({
      name: 'diff',
      attrs: ['op1', 'op2', 'diff'],
      instantiations: {
         '++-': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vop1, vop2, vdiff) {
               ns[vdiff] = ns[vop1] - ns[vop2];
               yield;
            }
         }
      }
   })

setup ::=
   function () {
      $.resetFacts($.born, [
         {country: 'ruthenia', born: 120},
         {country: 'poland', born: 150},
         {country: 'germany', born: 220},
      ]);

      $.resetFacts($.died, [
         {country: 'ruthenia', died: 135},
         {country: 'poland', died: 155},
         {country: 'germany', died: 205},
      ]);
   }

test_arithmetics ::=
   function () {
      $.checkLike(
         $.query($.growth, {}),
         new Set([
            {country: 'ruthenia', growth: -15},
            {country: 'poland', growth: -5},
            {country: 'germany', growth: 15},
         ])
      );
   }

test_arithmetics_changes ::=
   function () {
      let growth = $.queryAtMostOne($.growth, {country: 'ruthenia'}).growth;

      $.replaceWhere($.born, {country: 'ruthenia'}, rec => ({
         ...rec,
         born: rec.born + 10
      }));
      $.replaceWhere($.died, {country: 'ruthenia'}, rec => ({
         ...rec,
         died: rec.died + 5
      }));

      $.check($.queryAtMostOne($.growth, {country: 'ruthenia'}).growth === growth + 5);
   }
