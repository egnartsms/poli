common
   objId
   equal
   concat
   lessThan
   objLessThan
   map
trie
   * as: trie
   KeyedSet
   Map
vector
   Vector
dedb-common
   RecordType
dedb-base
   addFact
   makeEntity
   patchEntity
dedb-rec-key
   recKey
   recVal
dedb-index
   indexOn
dedb-query
   query
   dumpRecencyList
-----
rel ::= ({
   module: null,
   entry: null,
   import: null,
   star_import: null
})
createRelations ::= function () {
   Object.assign($.rel, {
      module: $.baseRelation({
         name: 'module',
         recType: $.RecordType.keyTuple,
         isEntity: true,
         attrs: ['name', 'lang', 'members'],
         indices: [
            $.indexOn(['name'], {isUnique: true})
         ]
      }),

      entry: $.baseRelation({
         name: 'entry',
         recType: $.RecordType.keyTuple,
         isEntity: true,
         attrs: ['name', 'strDef', 'def', 'module'],
         indices: [
            $.indexOn(['module']),
            $.indexOn(['module', 'name'], {isUnique: true})
         ]
      }),

      import: $.baseRelation({
         name: 'import',
         recType: $.RecordType.tuple,
         attrs: ['entry', 'recp', 'alias'],
         indices: [
            // $.indexOn([''])
         ]
      }),

      star_import: $.baseRelation({
         name: 'star_import',
         recType: $.RecordType.tuple,
         attrs: ['donor', 'recp', 'alias'],
         indices: [
         ]
      })
   });
}
tryOut ::= function () {
   let entry_potential_references = $.derivedRelation({
      name: 'entry_potential_references',
      recType: $.RecordType.keyVal,
      body: v => [
         $.select($.rel.entry, {
            [$.recKey]: v.recKey,
            def: v`def`
         }),
         $.func1to1($.extractRefs, [v`def`, v.recVal])
      ]
   })
   let import_usage = $.derivedRelation({
      name: 'import_usage',
      recType: $.RecordType.tuple,
      attrs: ['module_name', 'import', 'referrer_entry'],
      body: v => [
         $.select($.rel.module, {
            name: v`'module_name`,
            [$.recKey]: v`module`
         }),
         $.select($.rel.import, {
            recp: v`module`,

         })
      ]
   });

}
load ::= function (minfos) {
   console.time('load world');

   $.createRelations();

   // Modules and entries
   for (let minfo of minfos) {
      // minfo :: [{name, lang, imports, body, ns}]
      let module = $.makeEntity($.rel.module, {
         name: minfo.name,
         lang: minfo.lang,
         members: null,
         // These are not visible to the DEDB (transient)
         ns: minfo.ns,
         nsDelta: null,
      });

      let entries = Array.from(minfo.body, ([name, code]) => {
         code = code.trim();
         return $.makeEntity($.rel.entry, {
            name: name,
            strDef: code,
            def: code,
            module: module
         });
      });

      $.patchEntity(module, m => ({
         ...m,
         members: $.Vector(entries)
      }));
   }

   // Imports
   for (let {name: recpName, imports} of minfos) {
      let recp = $.queryScalarKey($.rel.module, {name: recpName});
      
      for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
         let donor = $.queryScalarKey($.rel.module, {name: donorName});

         if (asterisk !== null) {
            $.addFact($.rel.star_import, {donor, recp, alias: asterisk});
         }

         for (let {entry: entryName, alias} of entryImports) {
            let entry = $.queryScalarKey($.rel.entry, {module: donor, name: entryName});

            $.addFact($.rel.import, {entry, recp, alias});
         }
      }
   }

   console.timeEnd('load world');

   $.dumpRecencyList();
}
