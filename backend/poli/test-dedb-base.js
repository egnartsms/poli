common
   check
   isLike
   checkLike
   checkThrows
   find
   sortedArray
dedb-query
   query
   query1
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-base
   addFact
   removeFact
   removeWhere
   baseRelation
   revertTo
dedb-version
   refRelationState
-----
box cityInfo ::= null
setup ::= function () {
   $.cityInfo = $.baseRelation({
      name: 'cityInfo',
      attrs: ['city', 'country', 'big'],
      indices: [
         ['country', 'big', 1]
      ],
      records: [
         {city: 'Paris', country: 'France', big: 1},
         {city: 'Marseille', country: 'France', big: 3},
         {city: 'Lyon', country: 'France', big: 2},

         {city: 'Warsaw', country: 'Poland', big: 1},
         {city: 'Wroclaw', country: 'Poland', big: 3},
         {city: 'Krakow', country: 'Poland', big: 2},

         {city: 'Kyiv', country: 'Ruthenia', big: 1},
         {city: 'Lviv', country: 'Ruthenia', big: 3},
         {city: 'Dnipro', country: 'Ruthenia', big: 2},

         {city: 'Beijing', country: 'China', big: 3},
         {city: 'Chongqing', country: 'China', big: 1},
         {city: 'Shanghai', country: 'China', big: 2},

         {city: 'Delhi', country: 'India', big: 1},
         {city: 'Mumbai', country: 'India', big: 2},
         {city: 'Bangalore', country: 'India', big: 3},

         {city: 'Istanbul', country: 'Turkey', big: 1},
         {city: 'Ankara', country: 'Turkey', big: 2},
         {city: 'Izmir', country: 'Turkey', big: 3},

         {city: 'Toronto', country: 'Canada', big: 1},
         {city: 'Montreal', country: 'Canada', big: 2},
         {city: 'Vancouver', country: 'Canada', big: 3},
      ]
   });
}
test_query_unique_record ::= function () {
   $.checkLike(
      $.query1($.cityInfo, {country: 'Ruthenia', big: 1}),
      {
         country: 'Ruthenia',
         city: 'Kyiv',
         big: 1
      }
   );

   $.checkLike(
      $.query1($.cityInfo, {country: 'Canada', big: 2}),
      {
         country: 'Canada',
         city: 'Montreal',
         big: 2
      }
   );
}
test_query_records ::= function () {
   $.checkLike(
      $.query($.cityInfo, {country: 'Ruthenia'}),
      new Set([
         {country: 'Ruthenia', city: 'Kyiv', big: 1},
         {country: 'Ruthenia', city: 'Dnipro', big: 2},
         {country: 'Ruthenia', city: 'Lviv', big: 3},
      ])
   );

   $.checkLike(
      $.query($.cityInfo, {country: 'Ruthenia', big: 3}),
      new Set([{country: 'Ruthenia', city: 'Lviv', big: 3}])
   );
}
test_query_records_extra_bound ::= function () {
   $.checkLike(
      $.query($.cityInfo, {country: 'India', big: 1, city: 'Delhi'}),
      new Set([
         {country: 'India', city: 'Delhi', big: 1}
      ])
   );

   $.checkLike(
      $.query($.cityInfo, {country: 'India', big: 1, city: 'Mumbai'}),
      new Set()
   );
}
test_query_no_index_hit_results_in_exc ::= function () {
   $.checkThrows(() => {
      $.query($.cityInfo, {city: 'Paris'});
   });
}
test_revert_to ::= function () {
   let ver0 = $.refRelationState($.cityInfo);

   $.removeWhere($.cityInfo, {country: 'China'});
   $.removeWhere($.cityInfo, {country: 'India'});
   $.check($.cityInfo.records.size === 15);

   let ver1 = $.refRelationState($.cityInfo);

   $.removeWhere($.cityInfo, {country: 'Turkey'});
   $.removeWhere($.cityInfo, {country: 'Poland'});
   $.check($.cityInfo.records.size === 9);

   $.revertTo(ver1);
   $.check($.cityInfo.records.size === 15);

   $.revertTo(ver0);
   $.check($.cityInfo.records.size === 21);
}
