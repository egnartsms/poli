common
   assert
   isLike
   find
prolog
   query
   projByQuery
   addFact
   removeFact
   relations as: rels
   isUnfilteredProjection
-----
test_projection_updates ::= function () {
   $.assert($.isLike(
      $.query($.rels.country, ['name'], {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'}
      ]
   ))

   let t_italy = {name: 'Italy', continent: 'Europe'}
   $.addFact($.rels.country, t_italy);
   $.assert($.isLike(
      $.query($.rels.country, ['name'], {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
         {name: 'Italy'}
      ]
   ));

   $.removeFact($.rels.country, t_italy);
   $.assert($.isLike(
      $.query($.rels.country, ['name'], {continent: 'Europe'}),
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
      $.query($.rels.country, ['name'], {continent: 'Europe'}),
      [
         {name: 'Poland'},
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));

   $.removeFact($.rels.country, t_poland);
   $.assert($.isLike(
      $.query($.rels.country, ['name'], {continent: 'Europe'}),
      [
         {name: 'Ruthenia'},
         {name: 'France'},
      ]
   ));
}
test_proj_no_free_vars ::= function () {
   $.assert($.isLike(
      $.query($.rels.country, [], {name: 'India', continent: 'Asia'}),
      [
         {}
      ]
   ));

   let t_india = $.find($.rels.country.facts, f => f.name === 'India');
   $.removeFact($.rels.country, t_india);
   $.assert($.isLike(
      $.query($.rels.country, [], {name: 'India', continent: 'Asia'}),
      []
   ));
}
test_unfiltered_projections ::= function () {
   $.assert($.isUnfilteredProjection($.projByQuery($.rels.continent, [], {})));
   $.assert($.isUnfilteredProjection($.projByQuery($.rels.continent, ['name'], {})));
   $.assert($.isUnfilteredProjection($.projByQuery($.rels.country, [], {})));
   $.assert($.isUnfilteredProjection($.projByQuery($.rels.country, ['continent'], {})));

   $.assert($.isLike(
      $.query($.rels.continent, ['name'], {}),
      [
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]
   ));

   $.assert($.isLike(
      $.query($.rels.continent, [], {}),
      [
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]
   ));
}
