common
   check
   isLike
   checkLike
dedb-index
   Fitness
dedb-goal
   use
dedb-query
   query
   valueAt
dedb-base
   addFact
   removeFact
   changeFact
   baseRelation
dedb-derived
   derivedRelation
dedb-functional
   functionalRelation
-----
setup ::= function () {
   $.setItem = $.functionalRelation({
      name: 'setItem',
      attrs: ['set', 'item'],
      instantiations: {
         '++': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vset, vitem) {
               if (ns[vset].has(ns[vitem])) {
                  yield;
               }
            }
         },
         '+-': {
            fitness: $.Fitness.hit,
            *run(ns, vset, vitem) {
               for (let x of ns[vset]) {
                  ns[vitem] = x;
                  yield;
               }
            }
         }
      }
   });

   $.countryCities = $.baseRelation({
      name: 'countryCities',
      isKeyed: true,
      records: [
         ['ruthenia', new Set(['kyiv', 'dnipro', 'lviv', 'odessa', 'kharkiv'])],
         ['poland', new Set(['warsaw', 'wroclaw', 'gdansk', 'lodz', 'poznan'])]
      ]
   });

   $.countryCity = $.derivedRelation({
      name: 'countryCity',
      attrs: ['country', 'city'],
      body: v => [
         $.use($.countryCities, v`country`, v`cities`),
         $.use($.setItem, {set: v`cities`, item: v`city`})
      ]
   });

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
box countryCities ::= null
box countryCity ::= null
box setItem ::= null
test_basic ::= function () {
   $.checkLike(
      $.query($.countryCity, {country: 'poland'}),
      new Set([
         {city: 'warsaw'},
         {city: 'wroclaw'},
         {city: 'gdansk'},
         {city: 'lodz'},
         {city: 'poznan'}
      ])
   );
}
test_remove ::= function () {
   $.changeFact($.countryCities, 'ruthenia', new Set(['kyiv', 'dnipro']));

   $.checkLike(
      $.query($.countryCity, {country: 'ruthenia'}),
      new Set([
         {city: 'kyiv'},
         {city: 'dnipro'}
      ])
   );
}
test_add ::= function () {
   $.addFact($.countryCities, 'england', new Set(['london', 'manchester', 'sheffield']));

   $.checkLike($.query($.countryCity, {}), new Set([
      {country: 'poland', city: 'warsaw'},
      {country: 'poland', city: 'wroclaw'},
      {country: 'poland', city: 'gdansk'},
      {country: 'poland', city: 'lodz'},
      {country: 'poland', city: 'poznan'},

      {country: 'ukraine', city: 'kyiv'},
      {country: 'ukraine', city: 'dnipro'},
      {country: 'ukraine', city: 'lviv'},
      {country: 'ukraine', city: 'odessa'},
      {country: 'ukraine', city: 'kharkiv'},

      {country: 'england', city: 'london'},
      {country: 'england', city: 'manchester'},
      {country: 'england', city: 'sheffield'},
   ]));
}
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
