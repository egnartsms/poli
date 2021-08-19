prolog-projection
   projectionFor
   releaseProjection
   updateProjection
prolog-base
   baseRelation
   addFact
   removeFact
prolog-derived
   derivedRelation
prolog-update-scheme
   visualizeIncrementalUpdateScheme
-----
relations ::= ({})
initialize ::= function () {
   let f_europe;
   let continent = $.baseRelation({
      name: 'continent',
      attrs: ['name'],
      indices: [
         Object.assign(['name'], {isUnique: true})
      ],
      facts: new Set([
         f_europe = {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]),
   });

   let f_ruthenia;

   let country = $.baseRelation({
      name: 'country',
      attrs: ['name', 'continent'],
      indices: [
         Object.assign(['name'], {isUnique: true}),
         // ['name'],
         ['continent']
      ],
      facts: new Set([
         {continent: 'Europe', name: 'France'},
         {continent: 'Europe', name: 'Poland'},
         f_ruthenia = {continent: 'Europe', name: 'Ruthenia'},
         {continent: 'Asia', name: 'China'},
         {continent: 'Asia', name: 'India'},
         {continent: 'Asia', name: 'Turkey'},
         {continent: 'America', name: 'Canada'},
         {continent: 'America', name: 'USA'}
      ]),
   });

   let f_dnipro;
   let city = $.baseRelation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
      indices: [
         ['country']
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
         f_dnipro = {country: 'Ruthenia', name: 'Dnipro', population: 0.993},

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

   Object.assign($.relations, {continent, country, city, continent_city});

   $.visualizeIncrementalUpdateScheme(continent_city);

   let proj = $.projectionFor(continent_city, {});
   proj.refcount += 1;

   console.log(Array.from(proj.value));

   // $.removeFact(country, f_ruthenia);
   $.removeFact(continent, f_europe);
   // $.removeFact(city, f_dnipro);
   $.updateProjection(proj);
   console.log(Array.from(proj.value));
   
   // $.addFact(country, f_ruthenia);
   // $.updateProjection(proj);
   // console.log(Array.from(proj.value));

   $.addFact(city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
   $.updateProjection(proj);
   console.log(Array.from(proj.value));

   $.addFact(continent, f_europe);
   $.updateProjection(proj);
   console.log(Array.from(proj.value));


   $.releaseProjection(proj);   
}
