common
   assert
   isLike
   find
prolog
   relations as: rels
prolog-query
   query
prolog-projection
   projectionFor
   releaseProjection
   isFullProjection
   updateProjection
prolog-base
   baseRelation
   addFact
   removeFact
prolog-derived
   derivedRelation
prolog-index
   indexOn
-----
runTests ::= function () {
   for (let [k, v] of Object.entries($)) {
      if (k.startsWith('test_')) {
         let rels = $.recreateRelations();
         v(rels);
      }
   }
}
recreateRelations ::= function () {
   let continent = $.baseRelation({
      name: 'continent',
      attrs: ['name'],
      indices: [
         $.indexOn(['name'], {isUnique: true})
      ],
      facts: new Set([
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]),
   });

   let country = $.baseRelation({
      name: 'country',
      attrs: ['name', 'continent'],
      indices: [
         $.indexOn(['name'], {isUnique: true}),
         // ['name'],
         ['continent']
      ],
      facts: new Set([
         {continent: 'Europe', name: 'France'},
         {continent: 'Europe', name: 'Poland'},
         {continent: 'Europe', name: 'Ruthenia'},
         {continent: 'Asia', name: 'China'},
         {continent: 'Asia', name: 'India'},
         {continent: 'Asia', name: 'Turkey'},
         {continent: 'America', name: 'Canada'},
         {continent: 'America', name: 'USA'}
      ]),
   });

   let city = $.baseRelation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
      indices: [
         $.indexOn(['country'])
      ],
      facts: new Set([
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
      ])
   });

   let continent_city = $.derivedRelation(v => ({
      name: 'continent_city',
      attrs: ['continent', 'city'],
      body: [
         {
            rel: continent,
            attrs: {name: v`continent`}
         },
         {
            rel: country,
            attrs: {continent: v`continent`, name: v`country`}
         },
         {
            rel: city,
            attrs: {country: v`country`, name: v`city`}
         }
      ]
   }));

   return {continent, country, city, continent_city};
}
test_base_projection_update ::= function ({country}) {
   $.assert($.isLike(
      $.query(country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'}
      ]
   ))

   let t_italy = {name: 'Italy', continent: 'Europe'}
   $.addFact(country, t_italy);
   $.assert($.isLike(
      $.query(country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
         {name: 'Italy'}
      ]
   ));

   $.removeFact(country, t_italy);
   $.assert($.isLike(
      $.query(country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));

   let t_poland = $.find(country.facts, f => f.name === 'Poland');
   $.removeFact(country, t_poland);
   $.addFact(country, t_poland);
   $.assert($.isLike(
      $.query(country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));

   $.removeFact(country, t_poland);
   $.assert($.isLike(
      $.query(country, {continent: 'Europe'}),
      [
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));
}
test_base_proj_no_free_vars ::= function ({country}) {
   // No free vars but we still store references to facts themselves
   $.assert($.isLike(
      $.query(country, {name: 'India', continent: 'Asia'}),
      [
         {name: 'India', continent: 'Asia'}
      ]
   ));

   let t_india = $.find(country.facts, f => f.name === 'India');
   $.removeFact(country, t_india);
   $.assert($.isLike(
      $.query(country, {name: 'India', continent: 'Asia'}),
      []
   ));
}
test_base_unfiltered_projection ::= function ({country, continent}) {
   $.assert($.isFullProjection($.projectionFor(continent, {})));

   $.assert($.isLike(
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
   $.assert(proj.depVer === country.myVer);
}
test_derived_partial_projection ::= function ({continent_city}) {
   $.assert($.isLike(
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

   $.assert(proj.value.size === 21);

   let f_europe = $.find(continent.facts, c => c.name === 'Europe');
   $.removeFact(continent, f_europe);
   $.updateProjection(proj);
   $.assert(proj.value.size === 12);
   
   $.addFact(city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
   $.addFact(continent, f_europe);
   $.updateProjection(proj);
   $.assert(proj.value.size === 22);
}
test_derived_partial_projection_updates ::= function ({continent_city, city, country}) {
   let proj = $.projectionFor(continent_city, {continent: 'America'});
   proj.refcount += 1;

   let f_newyork = {country: 'USA', name: 'New York', population: 20}
   $.addFact(city, f_newyork);
   $.updateProjection(proj);
   
   $.assert($.isLike(
      proj.value,
      [
         {city: 'Toronto'},
         {city: 'Montreal'},
         {city: 'Vancouver'},
         {city: 'New York'}
      ]
   ));

   let f_canada = $.find(country.facts, country => country.name === 'Canada');
   $.removeFact(country, f_canada);
   $.updateProjection(proj);

   $.assert($.isLike(
      proj.value,
      [
         {city: 'New York'}
      ]
   ));

   $.releaseProjection(proj);
}
test_derived_scalar_updates ::= function ({continent_city, city}) {
   let proj = $.projectionFor(continent_city, {continent: 'America', city: 'Toronto'});
   proj.refcount += 1;

   $.assert(proj.value.size === 1);

   let f_toronto = $.find(city.facts, c => c.name === 'Toronto');
   $.removeFact(city, f_toronto);
   $.updateProjection(proj);

   $.assert(proj.value.size === 0);

   $.addFact(city, f_toronto);
   $.updateProjection(proj);

   $.assert(proj.value.size === 1);
}