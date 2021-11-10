common
   check
   isLike
   checkLike
   find
   sortedArray
dedb-query
   query
   queryUniqueRecord
   valueAtKey
dedb-relation
   RelationType
dedb-common
   RecordType
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-base
   isFullProjection
   addFact
   removeFact
dedb-index
   indexOn
-----
countryCode ::= ({
   name: 'countryCode',
   isKeyed: true,
   records: [
      ['France', 'fr'],
      ['Poland', 'pl'],
      ['Ruthenia', 'ru'],
      ['China', 'ch'],
      ['India', 'in'],
      ['Turkey', 'tr'],
      ['Canada', 'ca']
   ]
})
city ::= ({
   name: 'city',
   attrs: ['country', 'city', 'population'],
   indices: [
      ['country', 'city', 1]
   ],
   records: [
      {country: 'France', city: 'Paris', population: 13.024},
      {country: 'France', city: 'Marseille', population: 1.761},
      {country: 'France', city: 'Lyon', population: 2.323},

      {country: 'Poland', city: 'Warsaw', population: 3.100},
      {country: 'Poland', city: 'Wroclaw', population: 1.250},
      {country: 'Poland', city: 'Krakow', population: 1.725},

      {country: 'Ruthenia', city: 'Kyiv', population: 3.375},
      {country: 'Ruthenia', city: 'Lviv', population: 0.720},
      {country: 'Ruthenia', city: 'Dnipro', population: 0.993},

      {country: 'China', city: 'Beijing', population: 21.707},
      {country: 'China', city: 'Chongqing', population: 30.165},
      {country: 'China', city: 'Shanghai', population: 24.183},

      {country: 'India', city: 'Delhi', population: 29.000},
      {country: 'India', city: 'Mumbai', population: 24.400},
      {country: 'India', city: 'Bangalore', population: 8.443},

      {country: 'Turkey', city: 'Istanbul', population: 14.025},
      {country: 'Turkey', city: 'Ankara', population: 4.587},
      {country: 'Turkey', city: 'Izmir', population: 2.847},

      {country: 'Canada', city: 'Toronto', population: 6.417},
      {country: 'Canada', city: 'Montreal', population: 4.247},
      {country: 'Canada', city: 'Vancouver', population: 2.463}
   ]
})
cityInfo ::= ({
   name: 'cityInfo',
   isKeyed: true,
   attrs: ['country', 'population'],
   indices: [
      ['country', 'big', 1]
   ],
   records: [
      ['Paris', {country: 'France', big: 1}],
      ['Marseille', {country: 'France', big: 3}],
      ['Lyon', {country: 'France', big: 2}],

      ['Warsaw', {country: 'Poland', big: 1}],
      ['Wroclaw', {country: 'Poland', big: 3}],
      ['Krakow', {country: 'Poland', big: 2}],

      ['Kyiv', {country: 'Ruthenia', big: 1}],
      ['Lviv', {country: 'Ruthenia', big: 3}],
      ['Dnipro', {country: 'Ruthenia', big: 2}],

      ['Beijing', {country: 'China', big: 3}],
      ['Chongqing', {country: 'China', big: 1}],
      ['Shanghai', {country: 'China', big: 2}],

      ['Delhi', {country: 'India', big: 1}],
      ['Mumbai', {country: 'India', big: 2}],
      ['Bangalore', {country: 'India', big: 3}],

      ['Istanbul', {country: 'Turkey', big: 1}],
      ['Ankara', {country: 'Turkey', big: 2}],
      ['Izmir', {country: 'Turkey', big: 3}],

      ['Toronto', {country: 'Canada', big: 1}],
      ['Montreal', {country: 'Canada', big: 2}],
      ['Vancouver', {country: 'Canada', big: 3}]
   ]
})
test_value_at_key ::= function () {
   $.checkLike($.valueAtKey($.countryCode, 'Ruthenia'), 'ru');
   $.checkLike($.valueAtKey($.countryCode, 'Poland'), 'pl');
}
test_query_unique_record_in_nonkeyed_relation ::= function () {
   $.checkLike(
      $.queryUniqueRecord($.city, {country: 'France', city: 'Lyon'}),
      {country: 'France', city: 'Lyon', population: 2.323}
   );

   $.checkLike(
      $.queryUniqueRecord($.city, {country: 'Turkey', city: 'Ankara'}),
      {country: 'Turkey', city: 'Ankara', population: 4.587}
   );
}
test_query_unique_record_in_keyed_relation ::= function () {
   $.checkLike(
      $.queryUniqueRecord($.cityInfo, {country: 'France', big: 2}),
      ['Lyon', {country: 'France', big: 2}]
   );

   $.checkLike(
      $.queryUniqueRecord($.cityInfo, {country: 'Turkey', big: 2}),
      ['Ankara', {country: 'Turkey', big: 2}]
   );
}
