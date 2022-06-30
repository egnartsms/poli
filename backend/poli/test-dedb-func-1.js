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
dedb-base
   resetFacts
   addFact
   removeFact
   replaceWhere
   baseRelation
dedb-derived
   derivedRelation
dedb-functional
   functionalRelation
-----

setItem ::=
   $.functionalRelation({
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
   })

countryCities ::=
   $.baseRelation({
      name: 'countryCities',
      attrs: ['country', 'cities'],
      indices: [['country', 1]]
   })

countryCity ::=
   $.derivedRelation({
      name: 'countryCity',
      attrs: ['country', 'city'],
      body: v => [
         $.use($.countryCities, {country: v`country`, cities: v`cities`}),
         $.use($.setItem, {set: v`cities`, item: v`city`})
      ]
   })

setup ::=
   function () {
      $.resetFacts($.countryCities, [
         {
            country: 'ruthenia',
            cities: new Set(['kyiv', 'dnipro', 'lviv', 'odessa', 'kharkiv'])
         },
         {
            country: 'poland',
            cities: new Set(['warsaw', 'wroclaw', 'gdansk', 'lodz', 'poznan'])
         }
      ]);
   }

test_basic ::=
   function () {
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

test_remove ::=
   function () {
      $.replaceWhere($.countryCities, {country: 'ruthenia'}, rec => ({
         ...rec,
         cities: new Set(['kyiv', 'dnipro'])
      }));

      $.checkLike(
         $.query($.countryCity, {country: 'ruthenia'}),
         new Set([
            {city: 'kyiv'},
            {city: 'dnipro'}
         ])
      );
   }

test_add ::=
   function () {
      $.addFact($.countryCities, {
         country: 'england',
         cities: new Set(['london', 'manchester', 'sheffield'])
      });

      $.checkLike($.query($.countryCity, {}), new Set([
         {country: 'poland', city: 'warsaw'},
         {country: 'poland', city: 'wroclaw'},
         {country: 'poland', city: 'gdansk'},
         {country: 'poland', city: 'lodz'},
         {country: 'poland', city: 'poznan'},

         {country: 'ruthenia', city: 'kyiv'},
         {country: 'ruthenia', city: 'dnipro'},
         {country: 'ruthenia', city: 'lviv'},
         {country: 'ruthenia', city: 'odessa'},
         {country: 'ruthenia', city: 'kharkiv'},

         {country: 'england', city: 'london'},
         {country: 'england', city: 'manchester'},
         {country: 'england', city: 'sheffield'},
      ]));
   }
