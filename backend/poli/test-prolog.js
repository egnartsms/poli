common
   assert
   isLike
   find
prolog
   relations as: rels
prolog-query
   query
prolog-fact
   projectionFor
   addFact
   removeFact
   isFullProjection
   updateProjection
-----
test_projection_updates ::= function () {
   $.assert($.isLike(
      $.query($.rels.country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'}
      ]
   ))

   let t_italy = {name: 'Italy', continent: 'Europe'}
   $.addFact($.rels.country, t_italy);
   $.assert($.isLike(
      $.query($.rels.country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
         {name: 'Italy'}
      ]
   ));

   $.removeFact($.rels.country, t_italy);
   $.assert($.isLike(
      $.query($.rels.country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));

   let t_poland = $.find($.rels.country.facts, f => f.name === 'Poland');
   $.removeFact($.rels.country, t_poland);
   $.addFact($.rels.country, t_poland);
   $.assert($.isLike(
      $.query($.rels.country, {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));

   $.removeFact($.rels.country, t_poland);
   $.assert($.isLike(
      $.query($.rels.country, {continent: 'Europe'}),
      [
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));
}
test_proj_no_free_vars ::= function () {
   // No free vars but we still store references to facts themselves
   $.assert($.isLike(
      $.query($.rels.country, {name: 'India', continent: 'Asia'}),
      [
         {name: 'India', continent: 'Asia'}
      ]
   ));

   let t_india = $.find($.rels.country.facts, f => f.name === 'India');
   $.removeFact($.rels.country, t_india);
   $.assert($.isLike(
      $.query($.rels.country, {name: 'India', continent: 'Asia'}),
      []
   ));
}
test_unfiltered_projections ::= function () {
   $.assert($.isFullProjection($.projectionFor($.rels.continent, {})));

   $.assert($.isLike(
      $.query($.rels.continent, {}),
      [
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]
   ));

   let proj;

   proj = $.projectionFor($.rels.country, {});
   $.updateProjection(proj);
   $.assert(proj.base === $.rels.country.latestVersion);
}
