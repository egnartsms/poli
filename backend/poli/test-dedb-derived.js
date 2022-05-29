common
   checkLike
   check
dedb-query
   lookupDerivedProjection
   query
   queryAtMostOne
dedb-goal
   use
dedb-base
   addFact
   removeFact
   removeWhere
   baseRelation
dedb-derived
   derivedRelation
dedb-projection
   updateProjection
   releaseProjection
-----
box continent ::= null
box country ::= null
box city ::= null
box continentCity ::= null

setup ::=
   function () {
      $.continent = $.baseRelation({
         name: 'continent',
         attrs: ['name'],
         indices: [
            ['name', 1]
         ],
         records: [
            {name: 'Europe'},
            {name: 'Asia'},
            {name: 'America'}
         ]
      });

      $.country = $.baseRelation({
         name: 'country',
         attrs: ['name', 'continent'],
         indices: [
            ['name', 1],
            ['continent']
         ],
         records: [
            {continent: 'Europe', name: 'France'},
            {continent: 'Europe', name: 'Poland'},
            {continent: 'Europe', name: 'Ruthenia'},
            {continent: 'Asia', name: 'China'},
            {continent: 'Asia', name: 'India'},
            {continent: 'Asia', name: 'Turkey'},
            {continent: 'America', name: 'Canada'},
            {continent: 'America', name: 'USA'}
         ]
      });

      $.city = $.baseRelation({
         name: 'city',
         attrs: ['country', 'name', 'population'],
         indices: [
            ['name', 1],
            ['country']
         ],
         records: [
            {country: 'France', name: 'Paris', population: 13.024},
            {country: 'France', name: 'Marseille', population: 1.761},
            {country: 'France', name: 'Lyon', population: 2.323},

            {country: 'Poland', name: 'Warsaw', population: 3.100},
            {country: 'Poland', name: 'Wroclaw', population: 1.250},
            {country: 'Poland', name: 'Krakow', population: 1.725},

            {country: 'Ruthenia', name: 'Kyiv', population: 3.375},
            {country: 'Ruthenia', name: 'Lviv', population: 0.720},
            {country: 'Ruthenia', name: 'Dnipro', population: 0.993},

            {country: 'China', name: 'Beijing', population: 21.707},
            {country: 'China', name: 'Chongqing', population: 30.165},
            {country: 'China', name: 'Shanghai', population: 24.183},

            {country: 'India', name: 'Delhi', population: 29.000},
            {country: 'India', name: 'Mumbai', population: 24.400},
            {country: 'India', name: 'Bangalore', population: 8.443},

            {country: 'Turkey', name: 'Istanbul', population: 14.025},
            {country: 'Turkey', name: 'Ankara', population: 4.587},
            {country: 'Turkey', name: 'Izmir', population: 2.847},

            {country: 'Canada', name: 'Toronto', population: 6.417},
            {country: 'Canada', name: 'Montreal', population: 4.247},
            {country: 'Canada', name: 'Vancouver', population: 2.463},

            {country: 'USA', name: 'New York', population: 8.622},
            {country: 'USA', name: 'Los Angeles', population: 4.085},
            {country: 'USA', name: 'Chicago', population: 2.670},
            {country: 'USA', name: 'Houston', population: 2.378},
         ]
      });

      $.continentCity = $.derivedRelation({
         name: 'continentCity',
         attrs: ['continent', 'city'],
         indices: [],
         body: v => [
            $.use($.continent, {name: v`continent`}),
            $.use($.country, {continent: v`continent`, name: v`country`}),
            $.use($.city, {country: v`country`, name: v`city`}),
         ]
      });
   }

test_query_no_bindings ::=
   function () {
      $.checkLike(
   		$.query($.continentCity, {}),
   		new Set([
   			{continent: 'Europe', city: 'Paris'},
   			{continent: 'Europe', city: 'Marseille'},
   			{continent: 'Europe', city: 'Lyon'},
   			{continent: 'Europe', city: 'Warsaw'},
   			{continent: 'Europe', city: 'Wroclaw'},
   			{continent: 'Europe', city: 'Krakow'},
   			{continent: 'Europe', city: 'Kyiv'},
   			{continent: 'Europe', city: 'Lviv'},
   			{continent: 'Europe', city: 'Dnipro'},

   			{continent: 'Asia', city: 'Beijing'},
   			{continent: 'Asia', city: 'Chongqing'},
   			{continent: 'Asia', city: 'Shanghai'},
   			{continent: 'Asia', city: 'Delhi'},
   			{continent: 'Asia', city: 'Mumbai'},
   			{continent: 'Asia', city: 'Bangalore'},
   			{continent: 'Asia', city: 'Istanbul'},
   			{continent: 'Asia', city: 'Ankara'},
   			{continent: 'Asia', city: 'Izmir'},

   			{continent: 'America', city: 'Toronto'},
   			{continent: 'America', city: 'Montreal'},
   			{continent: 'America', city: 'Vancouver'},
   			{continent: 'America', city: 'New York'},
   			{continent: 'America', city: 'Los Angeles'},
   			{continent: 'America', city: 'Chicago'},
   			{continent: 'America', city: 'Houston'},
   		])
   	);
   }

test_full_projection_updates ::=
   function () {
      let proj = $.lookupDerivedProjection($.continentCity, {});
      $.check(proj.records.size === 25);

      let f_europe = $.queryAtMostOne($.continent, {name: 'Europe'});
      $.removeFact($.continent, f_europe);
      $.updateProjection(proj);
      $.check(proj.records.size === 16);

      $.addFact($.city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
      $.addFact($.continent, f_europe);
      $.updateProjection(proj);

      $.check(proj.records.size === 26);

      let f_china = $.queryAtMostOne($.country, {name: 'China'});
      $.removeFact($.country, f_china);
      $.updateProjection(proj);
      $.check(proj.records.size === 23);
   }

test_partial_projection ::=
   function () {
      $.checkLike(
         $.query($.continentCity, {continent: 'America'}),
         new Set([
            {city: 'Toronto'},
            {city: 'Montreal'},
            {city: 'Vancouver'},
            {city: 'New York'},
            {city: 'Los Angeles'},
            {city: 'Chicago'},
            {city: 'Houston'},
         ])
      );
   }

test_partial_updates ::=
   function () {
      let proj = $.lookupDerivedProjection($.continentCity, {continent: 'America'});

      let f_canada = $.queryAtMostOne($.country, {name: 'Canada'});
      $.removeWhere($.country, {name: 'Canada'});
      $.updateProjection(proj);
      $.check(proj.records.size === 4);

      $.addFact($.country, {name: 'Canada', continent: 'America'});
      $.addFact($.city, {country: 'USA', name: 'Seattle', population: 2.2});
      $.updateProjection(proj);
      $.check(proj.records.size === 8);
   }

test_scalar_updates ::=
   function () {
      let rec = $.queryAtMostOne($.continentCity, {continent: 'Europe', city: 'Lviv'});
      $.check(rec !== null);

      $.removeWhere($.country, {name: 'Ruthenia'});

      rec = $.queryAtMostOne($.continentCity, {continent: 'Europe', city: 'Lviv'});
      $.check(rec === null);

      $.addFact($.country, {name: 'Ruthenia', continent: 'Asia'});
      rec = $.queryAtMostOne($.continentCity, {continent: 'Europe', city: 'Lviv'});
      $.check(rec === null);   

      $.removeWhere($.country, {name: 'Ruthenia'});
      $.addFact($.country, {name: 'Ruthenia', continent: 'Europe'});
      rec = $.queryAtMostOne($.continentCity, {continent: 'Europe', city: 'Lviv'});
      $.check(rec !== null);
   }
