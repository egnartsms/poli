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
box module ::= null
protoModule ::= ({})
module ::= function _poli_defer() {
   return $.baseRelation({
      name: 'module',
      entityProto: $.protoModule,
      attrs: ['name', 'lang', 'members'],
      indices: [
         ['name', 1]
      ]
   })
}
protoEntry ::= ({
})
entry ::= function _poli_defer() {
   return $.baseRelation({
      name: 'entry',
      entityProto: $.protoEntry,
      attrs: ['name', 'def', 'module'],
      indices: [
         ['module', 'name', 1]
      ]
   })
}
import ::= function _poli_defer() {
   return $.baseRelation({
      name: 'import',
      attrs: ['entry', 'recp', 'alias'],
      indices: []
   })
}
starImport ::= function _poli_defer() {
   return $.baseRelation({
      name: 'starImport',
      attrs: ['donor', 'recp', 'alias'],
      indices: []
   })
}
load ::= function (minfos) {
   console.time('load world');

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

      let entries = Array.from(minfo.body, ([name, code]) => {
         code = code.trim();
         return $.makeEntity($.entry, {
            name: name,
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
unwrapDefers ::= function (minfos) {
   let map = new Map;

   for (let minfo of minfos) {
      for (let [entry, wrapper] of Object.entries(minfo.ns)) {
         if ($.isDefer(wrapper)) {
            let value;

            if (map.has(wrapper)) {
               value = map.get(wrapper);
            }
            else {
               value = wrapper();
               map.set(wrapper, value);
            }

            minfo.ns[entry] = value;
         }
      }
   }
}
isDefer ::= function (val) {
   return typeof val === 'function' && val.name === '_poli_defer';
}
