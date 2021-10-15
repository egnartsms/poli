common
   check
   isLike
   find
   sortedArray
dedb-query
   query
dedb-projection
   projectionFor
   releaseProjection
   isFullBaseProjection
   updateProjection
dedb-base
   baseRelation
   addFact
   removeFact
dedb-derived
   derivedRelation
dedb-index
   indexOn
-----
setup ::= function () {
   let continent = $.baseRelation({
      name: 'continent',
      attrs: ['name'],
      indices: [
         $.indexOn(['name'], {isUnique: true})
      ],
      records: [
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ],
   });

   let country = $.baseRelation({
      name: 'country',
      attrs: ['name', 'continent'],
      indices: [
         $.indexOn(['name'], {isUnique: true}),
         // ['name'],
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
      ],
   });

   let city = $.baseRelation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
      indices: [
         $.indexOn(['name'], {isUnique: true}),
         $.indexOn(['country']),
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
         {country: 'Canada', name: 'Vancouver', population: 2.463}
      ]
   });

   let continent_city = $.derivedRelation({
      name: 'continent_city',
      attrs: ['continent', 'city'],
      indices: [
         $.indexOn(['city'], {isUnique: true})
      ],
      body: v => [
         continent.at({name: v`continent`}),
         country.at({continent: v`continent`, name: v`country`}),
         city.at({country: v`country`, name: v`city`}),
      ]
   });

   let continent_pop = $.derivedRelation({
      name: 'continent_pop',
      attrs: ['continent', 'pop'],
      body: v => [
         continent_city.at({continent: v`continent`, city: v`city`}),
         city.at({name: v`city`, population: v`pop`}),
      ]
   });

   return {continent, country, city, continent_city, continent_pop};
}
test_base_projection_update ::= function ({country}) {
   $.check($.isLike(
      $.sortedArray($.query(country, {continent: 'Europe'}), x => x.name),
      [
         {name: 'France'},
         {name: 'Poland'},
         {name: 'Ruthenia'},
      ]
   ))

   let t_italy = {name: 'Italy', continent: 'Europe'}
   $.addFact(country, t_italy);
   $.check($.isLike(
      $.sortedArray($.query(country, {continent: 'Europe'}), x => x.name),
      [
         {name: 'France'},
         {name: 'Italy'},
         {name: 'Poland'},
         {name: 'Ruthenia'},
      ]
   ));

   $.removeFact(country, t_italy);
   $.check($.isLike(
      $.sortedArray($.query(country, {continent: 'Europe'}), x => x.name),
      [
         {name: 'France'},
         {name: 'Poland'},
         {name: 'Ruthenia'},
      ]
   ));

   let t_poland = $.find(country.records, rec => rec.name === 'Poland');
   $.removeFact(country, t_poland);
   $.addFact(country, t_poland);
   $.check($.isLike(
      $.sortedArray($.query(country, {continent: 'Europe'}), x => x.name),
      [
         {name: 'France'},
         {name: 'Poland'},
         {name: 'Ruthenia'},
      ]
   ));

   $.removeFact(country, t_poland);
   $.check($.isLike(
      $.sortedArray($.query(country, {continent: 'Europe'}), x => x.name),
      [
         {name: 'France'},
         {name: 'Ruthenia'},
      ]
   ));
}
test_base_proj_no_free_vars ::= function ({country}) {
   // No free vars but we still store references to facts themselves
   $.check($.isLike(
      $.query(country, {name: 'India', continent: 'Asia'}),
      [
         {name: 'India', continent: 'Asia'}
      ]
   ));

   let t_india = $.find(country.records, rec => rec.name === 'India');
   $.removeFact(country, t_india);
   $.check($.isLike(
      $.query(country, {name: 'India', continent: 'Asia'}),
      []
   ));
}
test_base_unfiltered_projection ::= function ({country, continent}) {
   $.check($.isFullBaseProjection($.projectionFor(continent, {})));

   $.check($.isLike(
      $.query(continent, {}),
      [
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]
   ));

   let proj;

   proj = $.projectionFor(country, {});
   $.updateProjection(proj);
   $.check(proj.depVer === country.myVer);
}
test_derived_partial_projection ::= function ({continent_city}) {
   $.check($.isLike(
      $.query(continent_city, {continent: 'America'}),
      [
         {city: 'Toronto'},
         {city: 'Montreal'},
         {city: 'Vancouver'}
      ]
   ));
}
test_derived_full_projection_updates ::= function ({continent_city, continent, city}) {
   let proj = $.projectionFor(continent_city, {});

   $.check(proj.records.size === 21);

   let f_europe = $.find(continent.records, rec => rec.name === 'Europe');
   $.removeFact(continent, f_europe);
   $.updateProjection(proj);
   $.check(proj.records.size === 12);
   
   $.addFact(city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
   $.addFact(continent, f_europe);
   $.updateProjection(proj);
   $.check(proj.records.size === 22);
}
test_derived_partial_projection_updates ::= function ({continent_city, city, country}) {
   let proj = $.projectionFor(continent_city, {continent: 'America'});
   proj.refcount += 1;

   let f_newyork = {country: 'USA', name: 'New York', population: 20}
   $.addFact(city, f_newyork);
   $.updateProjection(proj);
   
   $.check($.isLike(
      proj.records,
      [
         {city: 'Toronto'},
         {city: 'Montreal'},
         {city: 'Vancouver'},
         {city: 'New York'}
      ]
   ));

   let f_canada = $.find(country.records, rec => rec.name === 'Canada');
   $.removeFact(country, f_canada);
   $.updateProjection(proj);

   $.check($.isLike(
      proj.records,
      [
         {city: 'New York'}
      ]
   ));

   $.releaseProjection(proj);
}
test_derived_scalar_updates ::= function ({continent_city, city}) {
   let proj = $.projectionFor(continent_city, {continent: 'America', city: 'Toronto'});
   proj.refcount += 1;

   $.check(proj.records.size === 1);

   let f_toronto = $.find(city.records, rec => rec.name === 'Toronto');
   $.removeFact(city, f_toronto);
   $.updateProjection(proj);

   $.check(proj.records.size === 0);

   $.addFact(city, f_toronto);
   $.updateProjection(proj);

   $.check(proj.records.size === 1);
}
test_derived_of_derived_updates ::= function ({continent_pop, city}) {
   let proj = $.projectionFor(continent_pop, {continent: 'America'});
   proj.refcount += 1;

   $.check($.isLike(
      proj.records,
      [
         {pop: 6.417},
         {pop: 4.247},
         {pop: 2.463},
      ]
   ));

   let f_newyork = {country: 'USA', name: 'New York', population: 20};
   $.addFact(city, f_newyork);
   $.updateProjection(proj);

   $.check($.isLike(
      proj.records,
      [
         {pop: 6.417},
         {pop: 4.247},
         {pop: 2.463},
         {pop: 20}
      ]
   ));

   $.removeFact(city, f_newyork);
   $.updateProjection(proj);

   $.check($.isLike(
      proj.records,
      [
         {pop: 6.417},
         {pop: 4.247},
         {pop: 2.463},
      ]
   ));
}