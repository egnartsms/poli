common
   check
   isLike
dedb-query
   query
dedb-functional
   functionalRelation
dedb-base
   baseRelation
   addFact
   removeFact
   changeFact
dedb-derived
   derivedRelation
dedb-projection
dedb-goal
   Shrunk
dedb-rec-key
   recKey
   recVal
dedb-common
   RecordType
-----
setup ::= function () {
   let country_cities = $.baseRelation({
      name: 'country_cities',
      recType: $.RecordType.keyVal,
      records: [
         ['ukraine', new Set(['kyiv', 'dnipro', 'lviv', 'odessa', 'kharkiv'])],
         ['poland', new Set(['warsaw', 'wroclaw', 'gdansk', 'lodz', 'poznan'])]
      ]
   });

   let set_member = $.functionalRelation({
      name: 'set_member',
      attrs: ['set', 'member'],
      instantiations: {
         '++': {
            shrunk: $.Shrunk.one,
            *run(ns, set, member) {
               if (set.has(member)) {
                  yield;
               }
            }
         },
         '+-': {
            shrunk: $.Shrunk.part,
            *run(ns, set, vmember) {
               for (let x of set) {
                  ns[vmember] = x;
                  yield;
               }
            }
         }
      }
   });

   let country_city = $.derivedRelation({
      name: 'country_city',
      recType: $.RecordType.tuple,
      attrs: ['country', 'city'],
      body: v => [
         country_cities.at({[$.recKey]: v`country`, [$.recVal]: v`cities`}),
         set_member.at({set: v`cities`, member: v`city`})
      ]
   });

   return {country_cities, country_city};
}
test_basic ::= function ({country_city}) {
   $.check($.isLike(
      $.query(country_city, {country: 'poland'}),
      [
         {city: 'warsaw'},
         {city: 'wroclaw'},
         {city: 'gdansk'},
         {city: 'lodz'},
         {city: 'poznan'}
      ]
   ));
}
test_remove ::= function ({country_cities, country_city}) {
   $.changeFact(country_cities, 'ukraine', new Set(['kyiv', 'dnipro']));

   $.check($.isLike($.query(country_city, {country: 'ukraine'}), [
      {city: 'kyiv'},
      {city: 'dnipro'}
   ]));
}
test_add ::= function ({country_cities, country_city}) {
   $.addFact(country_cities, 'england', new Set(['london', 'manchester', 'sheffield']));

   $.check($.isLike($.query(country_city, {}), [
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
   let born = $.baseRelation({
      name: 'born',
      recType: $.RecordType.keyVal,
      records: [
         ['ukraine', 120],
         ['poland', 150],
         ['germany', 220],
      ]
   });

   let died = $.baseRelation({
      name: 'died',
      recType: $.RecordType.keyVal,
      records: [
         ['ukraine', 135],
         ['poland', 155],
         ['germany', 205],
      ]
   });

   let subtraction = $.functionalRelation({
      name: 'subtraction',
      attrs: ['minuend', 'subtrahend', 'result'],
      instantiations: {
         '++-': {
            shrunk: $.Shrunk.one,
            *run(ns, minuend, subtrahend, vresult) {
               ns[vresult] = minuend - subtrahend;
               yield;
            }
         },
      }
   });

   let growth = $.derivedRelation({
      name: 'growth',
      recType: $.RecordType.keyVal,
      body: v => [
         born.at({[$.recKey]: v.recKey, [$.recVal]: v`born`}),
         died.at({[$.recKey]: v.recKey, [$.recVal]: v`died`}),
         subtraction.at({minuend: v`born`, subtrahend: v`died`, result: v.recVal})
      ]
   });

   $.check($.isLike($.query(growth, {}), [
      ['ukraine', -15],
      ['poland', -5],
      ['germany', 15]
   ]));
}
