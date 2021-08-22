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
prolog-index
   indexOn
prolog-index-instance
   refIndexInstance
   releaseIndexInstance
-----
relations ::= ({})
initialize ::= function () {
   // Object.assign($.relations, {continent, country, city, continent_city});

   // $.visualizeIncrementalUpdateScheme(continent_city);

   // let proj = $.projectionFor(continent_city, {continent: 'Asia'});
   // proj.refcount += 1;

   // console.log(Array.from(proj.value));

   // $.removeFact(continent, f_europe);
   // $.updateProjection(proj);
   // console.log(Array.from(proj.value));
   
   // $.addFact(city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
   // $.addFact(continent, f_europe);
   // $.updateProjection(proj);
   // console.log(Array.from(proj.value));

   // let idx = $.refIndexInstance(proj, $.indexOn(['continent']));
   // console.log(idx);

   // $.releaseIndexInstance(idx);
   // $.releaseProjection(proj);   
}
