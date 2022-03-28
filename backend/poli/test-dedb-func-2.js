common
   check
   isLike
   checkLike
dedb-index
   Fitness
dedb-base
   addFact
   removeFact
   changeFact
   baseRelation
dedb-derived
   derivedRelation
dedb-functional
   functionalRelation
dedb-query
   query
   valueAt
dedb-goal
   use
-----
setup ::= function () {
   $.plus = $.functionalRelation({
    name: 'plus',
    attrs: ['op1', 'op2', 'sum'],
    instantiations: {
       '+-+': {
          fitness: $.Fitness.uniqueHit,
          *run(ns, vop1, vop2, vsum) {
             ns[vop2] = ns[vsum] - ns[vop1];
             yield;
          }
       }
    }
   });

   $.born = $.baseRelation({
    name: 'born',
    isKeyed: true,
    records: [
       ['ruthenia', 120],
       ['poland', 150],
       ['germany', 220],
    ]
   });

   $.died = $.baseRelation({
    name: 'died',
    isKeyed: true,
    records: [
       ['ruthenia', 135],
       ['poland', 155],
       ['germany', 205],
    ]
   });

   $.growth = $.derivedRelation({
    name: 'growth',
    isKeyed: true,
    body: v => [
       $.use($.born, v.key, v`born`),
       $.use($.died, v.key, v`died`),
       $.use($.plus, {op1: v`died`, op2: v.value, sum: v`born`})
    ]
   });
}
box born ::= null
box died ::= null
box growth ::= null
box plus ::= null
test_arithmetics ::= function () {
   $.checkLike($.query($.growth, {}), new Set([
      ['ruthenia', -15],
      ['poland', -5],
      ['germany', 15]
   ]));
}
test_arithmetics_changes ::= function () {
   let born = $.valueAt($.born, 'ruthenia');
   let died = $.valueAt($.died, 'ruthenia');
   let growth = $.valueAt($.growth, 'ruthenia');

   $.changeFact($.born, 'ruthenia', born + 10);
   $.changeFact($.died, 'ruthenia', died + 5);

   $.check($.valueAt($.growth, 'ruthenia') === growth + 5);
}
