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
dedb-base
   addFact
   makeEntity
   patchEntity
   baseRelation
dedb-rec-key
   recKey
   recVal
dedb-index
dedb-query
   dumpRecencyList
   queryOne
-----
protoModule ::= ({})
protoEntry ::= ({})
box module ::= null
box entry ::= null
box import ::= null
box starImport ::= null
createRelations ::= function () {
   $.module = $.baseRelation({
      name: 'module',
      entityProto: $.protoModule,
      attrs: ['name', 'lang', 'members'],
      indices: [
         ['name', 1]
      ]
   });
   
   $.entry = $.baseRelation({
      name: 'entry',
      entityProto: $.protoEntry,
      attrs: ['module', 'name', 'def'],
      indices: [
         ['module', 'name', 1]
      ]
   });

   $.import = $.baseRelation({
      name: 'import',
      attrs: ['entry', 'recp', 'alias'],
      indices: []
   });

   $.starImport = $.baseRelation({
      name: 'starImport',
      attrs: ['donor', 'recp', 'alias'],
      indices: []
   });
}
load ::= function (minfos) {
   console.time('load world');

   $.createRelations();

   // Modules and entries
   for (let minfo of minfos) {
      // minfo :: [{name, lang, imports, body, ns}]
      let module = $.makeEntity($.module, {
         name: minfo.name,
         lang: minfo.lang,
         members: null,
         // These are not visible to the DEDB (transient)
         ns: minfo.ns,
         nsDelta: null,
      });

      let entries = Array.from(minfo.body, ({isBox, name, def}) => {
         return $.makeEntity($.entry, {
            name: name,
            def: def,
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
      let recp = $.queryOne($.module, {name: recpName});
      
      for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
         let donor = $.queryOne($.module, {name: donorName});

         if (asterisk !== null) {
            $.addFact($.starImport, {donor, recp, alias: asterisk});
         }

         for (let {entry: entryName, alias} of entryImports) {
            let entry = $.queryOne($.entry, {module: donor, name: entryName});

            $.addFact($.import, {entry, recp, alias});
         }
      }
   }

   console.timeEnd('load world');

   $.dumpRecencyList();
}
