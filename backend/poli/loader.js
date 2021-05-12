common
   map
   newObj
   objId
relation
   * as: rel
trie
   * as: trie
vector
   * as: vec
-----
nextModuleId ::= 1
Gstate ::= null
G ::= ({
   get modules() {
      return $.Gstate.modules;
   },
   get imports() {
      return $.Gstate.imports;
   }
})
importProto ::= ({
   get importedAs() {
      return this.alias || this.entry;
   }
})
import ::= function (obj) {
   return $.newObj($.importProto, obj);
}
main ::= function (modules) {
   function makeModule(module) {
      // module :: [{name, lang, imports, body, ns}]
      let entries = $.rel.Relation({
         pk: 'byName',
         groupings: {byName: 'name'},
         facts: module.lang !== 'js' ? null :
            (function* () {
               for (let [name, code] of module.body) {
                  code = code.trim();
                  yield {
                     name: name,
                     strDef: code,
                     def: code
                  };
               }
            }())
      });
      let members = $.vec.Vector(
         module.lang !== 'js' ? null : $.map(module.body, ([name, code]) => name)
      );

      return {
         id: $.nextModuleId++,
         name: module.name,
         lang: module.lang,
         entries: entries,
         members: members,
         ns: module.ns,
         nsDelta: null
      };
   }

   let Rmodules = $.rel.Relation({
      pk: 'byId',
      groupings: {
         byId: 'id',
         byName: 'name',
      },
      facts: $.map(modules, makeModule)
   });

   let Rimports = $.rel.Relation({
      pk: 'all',
      groupings: {
         all: $.objId,
         into: ['recpid', 'importedAs'],
         from: ['donorid', 'entry', 'recpid']
      },
      facts: (function* () {
         for (let {name: recpName, imports} of modules) {
            let {id: recpid} = $.trie.at(Rmodules.byName, recpName);

            for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
               let {id: donorid} = $.trie.at(Rmodules.byName, donorName);

               if (asterisk !== null) {
                  yield $.import({
                     recpid,
                     donorid,
                     entry: '',
                     alias: asterisk,
                  });
               }

               for (let {entry, alias} of entryImports) {
                  yield $.import({
                     recpid,
                     donorid,
                     entry,
                     alias,
                  });
               }
            }
         }
      })()
   });
   
   $.Gstate = {
      imports: Rimports,
      modules: Rmodules
   };
}
