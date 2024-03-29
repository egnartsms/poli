common
   check
   isLike
   checkLike
   checkThrows
   find
   sortedArray

dedb-query
   getIndex

dedb-projection
   projectionFor
   releaseProjection
   updateProjection

dedb-base
   addFact
   addFacts
   resetRelation
   releaseVersion
   removeFact
   removeWhere
   baseRelation
   getRecords
   refProjectionVersion

dedb-version
   refRelationState

exp-b
   b as: circularName

-----

cityInfo ::=
   $.baseRelation({
      name: 'cityInfo',
      attrs: ['city', 'country', 'big'],
      indices: [
         ['country', 'big', 1]
      ]
   })


setup :thunk:=
   $.resetRelation($.cityInfo);
   $.addFacts($.cityInfo, [
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
   ]);


test_get_records :thunk:=
   let recs;

   recs = Array.from($.getRecords($.cityInfo, {country: 'Ruthenia', big: 1}));
   $.checkLike(recs, new Set([
      {city: 'Kyiv', country: 'Ruthenia', big: 1},
   ]));

   recs = Array.from($.getRecords($.cityInfo, {country: 'Ruthenia'}));
   $.checkLike(recs, new Set([
      {city: 'Kyiv', country: 'Ruthenia', big: 1},
      {city: 'Lviv', country: 'Ruthenia', big: 3},
      {city: 'Dnipro', country: 'Ruthenia', big: 2},
   ]));

   recs = Array.from($.getRecords($.cityInfo, {city: 'Toronto'}));
   $.checkLike(recs, new Set([
      {city: 'Toronto', country: 'Canada', big: 1},
   ]));


test_version_partial :thunk:=
   let ver = $.refProjectionVersion($.cityInfo, {country: 'India'});

   $.addFact($.cityInfo, {country: 'India', city: 'Chinnai', big: 4});
   $.removeWhere($.cityInfo, {city: 'Delhi'});

   $.checkLike(ver.added, new Set([{country: 'India', city: 'Chinnai', big: 4}]));
   $.checkLike(ver.removed, new Set([{country: 'India', city: 'Delhi', big: 1}]));

   $.releaseVersion(ver);


test_version_full :thunk:=
   let ver = $.refProjectionVersion($.cityInfo, {});

   $.addFact($.cityInfo, {country: 'India', city: 'Chinnai', big: 4});
   $.addFact($.cityInfo, {country: 'Ruthenia', city: 'Odesa', big: 4});
   $.removeWhere($.cityInfo, {city: 'Delhi'});

   $.checkLike(ver.added, new Set([
      {country: 'India', city: 'Chinnai', big: 4},
      {country: 'Ruthenia', city: 'Odesa', big: 4},
   ]));
   $.checkLike(ver.removed, new Set([{country: 'India', city: 'Delhi', big: 1}]));

   $.releaseVersion(ver);


xtest_projection ::=
   function () {
      let proj = $.projectionFor($.cityInfo, {country: 'Ruthenia'});

      $.addFact($.cityInfo, {country: 'Ruthenia', city: 'Odesa', big: 4})
      $.removeWhere($.cityInfo, {country: 'Turkey', })
      
      proj = $.projectionFor($.cityInfo, {country: 'Ruthenia', big: 1});
      $.checkLike(proj.rec, {
         country: 'Ruthenia',
         city: 'Kyiv',
         big: 1
      });

      proj = $.projectionFor($.cityInfo, {country: 'Canada', big: 2});
      $.checkLike(proj.rec, {
         country: 'Canada',
         city: 'Montreal',
         big: 2
      });
   }


xtest_partial_projection ::=
   function () {
      let proj = $.projectionFor($.cityInfo, {country: 'Ruthenia'});

      $.checkLike(
         proj,
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


xtest_query_records_extra_bound ::=
   function () {
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


xtest_query_no_index_hit_results_in_exc ::=
   function () {
      $.checkThrows(() => {
         $.query($.cityInfo, {city: 'Paris'});
      });
   }


xtest_revert_to ::=
   function () {
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
