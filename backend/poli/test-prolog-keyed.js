common
   check
   isLike
   find
prolog-query
   query
prolog-projection
   projectionFor
   releaseProjection
   isFullBaseProjection
   updateProjection
prolog-base
   baseRelation
   addFact
   removeFact
prolog-derived
   derivedRelation
prolog-index
   indexOn
prolog-shared
   recKey
   recVal
-----
runTests ::= function () {
   for (let [k, v] of Object.entries($)) {
      if (k.startsWith('test_')) {
      // if (['test_base_projection_update'].includes(k)) {
         let rels = $.recreateRelations();
         v(rels);
      }
   }
}
recreateRelations ::= function () {
   let
      e_A_joe = {name: 'joe'},
      e_A_jack = {name: 'jack'},
      e_B_joe = {name: 'joe'},
      e_B_kelly = {name: 'kelly'},
      e_B_stasy = {name: 'stasy'},
      e_C_jack = {name: 'jack'};

   let entry = $.baseRelation({
      name: 'entry',
      attrs: ['module', 'name'],
      hasNaturalIdentity: true,
      indices: [
         $.indexOn(['module', 'name'], {isUnique: true}),
         $.indexOn(['module'])
      ],
      records: [
         [e_A_joe, {module: 'A', name: 'joe'}],
         [e_A_jack, {module: 'A', name: 'jack'}],
         [e_B_joe, {module: 'B', name: 'joe'}],
         [e_B_kelly, {module: 'B', name: 'kelly'}],
         [e_B_stasy, {module: 'B', name: 'stasy'}],
         [e_C_jack, {module: 'C', name: 'jack'}],
      ],
   });

   let module = $.baseRelation({
      name: 'module',
      attrs: ['name', 'lang'],
      indices: [
         $.indexOn(['name'], {isUnique: true}),
      ],
      records: [
         {name: 'A', lang: 'js'},
         {name: 'B', lang: 'rust'},
         {name: 'C', lang: 'kotlin'}
      ],
   });

   let entry_lang = $.derivedRelation({
      name: 'entry_lang',
      attrs: ['entry', 'lang'],
      indices: [],
      body: v => [
         {
            rel: entry,
            attrs: {
               module: v`entry_module`,
               [v.key]: v`entry`
            }
         },
         {
            rel: module,
            attrs: {name: v`entry_module`, lang: v`lang`}
         }
      ]
   });

   return {
      entry,
      module,
      entry_lang,
      e_A_joe,
      e_A_jack,
      e_B_joe,
      e_B_kelly,
      e_B_stasy,
      e_C_jack,
   };
}
test_rebuild ::= function ({
   entry_lang,
   e_A_joe,
   e_A_jack,
   e_B_joe,
   e_B_kelly,
   e_B_stasy,
   e_C_jack
}) {
   $.check($.isLike(
      $.query(entry_lang, {}),
      [
         {entry: e_A_joe, lang: 'js'},
         {entry: e_A_jack, lang: 'js'},
         {entry: e_B_joe, lang: 'rust'},
         {entry: e_B_kelly, lang: 'rust'},
         {entry: e_B_stasy, lang: 'rust'},
         {entry: e_C_jack, lang: 'kotlin'},
      ]
   ));
}