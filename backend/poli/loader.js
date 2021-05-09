common
   map
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
         imported: null, // KeyedSet: <import> [importedAs]
         exported: null, // Map: entry => [<import>, ...]
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
         from: ['donorid', 'entry', $.objId]
      },
      facts: (function* () {
         for (let {name: donorName, imports} of modules) {
            let {id: recpid} = $.trie.at(Rmodules.byName, donorName);

            for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
               let {id: donorid} = $.trie.at(Rmodules.byName, donorName);

               if (asterisk !== null) {
                  yield {
                     recpid,
                     donorid,
                     entry: null,
                     alias: asterisk,
                     importedAs: asterisk
                  }
               }

               for (let {entry, alias} of entryImports) {
                  yield {
                     recpid,
                     donorid,
                     entry,
                     alias,
                     importedAs: alias || entry
                  }
               }
            }
         }
      })()
   });

   Rmodules = $.rel.alike(
      Rmodules,
      $.map(Rmodules, module => ({
         ...module,
         imported: $.trie.at(Rimports.into, module.id, $.trie.Map),
         exported: $.trie.at(Rimports.from, module.id, $.trie.Map)
      }))
   );
   
   $.Gstate = {
      imports: Rimports,
      modules: Rmodules
   };
}
makeJsModule ::= function ({name, lang, imports, body, $}) {
   // Make JS module, evaluate its entries but don't do any imports yet
   let module = {
      lang: 'js',
      name: name,

      // Import/export information is filled later
      imports: new Set(),
      exports: new Set(),
      importedNames: new Set(),
      
      entries: Array.from(body, ([entry]) => entry),
      // in JS, trim entry src definitions
      defs: Object.fromEntries(body.map(([entry, src]) => [entry, src.trim()])),

      rtobj: name === $_.BOOTSTRAP_MODULE ? $ : Object.create(null),
      delta: Object.create(null)
   };
   
   if (module.name !== $_.BOOTSTRAP_MODULE) {
      for (let entry of module.entries) {
         $.rtset(module, entry, $.moduleEval(module, module.defs[entry]));
      }
   }

   return module;
}
addModuleInfoImports ::= function ({name, imports}) {
   let recp = $.modules[name];

   for (let {donor: donorName, asterisk, imports: importrecs} of imports) {
      let donor = $.modules[donorName];
      if (asterisk !== null) {
         $.import({recp, donor, name: null, alias: asterisk});
      }
      for (let {entry, alias} of importrecs) {
         $.import({recp, donor, name: entry, alias});
      }
   }
}
importedAs ::= function (imp) {
   return imp.alias || imp.name;
}
import ::= function (imp) {
   $.validateImport(imp);
   
   let {recp, donor, name} = imp;

   recp.importedNames.add($.importedAs(imp));
   recp.imports.add(imp);
   donor.exports.add(imp);

   $.rtset(
      recp,
      $.importedAs(imp),
      name === null ? donor.rtobj : $.rtget(donor, name)
   );
}
validateImport ::= function (imp) {
   let importedAs = $.importedAs(imp);
   let {recp, donor, name, alias} = imp;

   // This check does only make sense for entry imports (not star imports)
   if (name !== null && !$.hasOwnProperty(donor.defs, name)) {
      throw new Error(
         `Module '${recp.name}': cannot import '${name}' from '${donor.name}': ` +
         `no such definition`
      );
   }
   if ($.hasOwnProperty(recp.defs, importedAs)) {
      throw new Error(
         `Module '${recp.name}': imported name '${importedAs}' from the module ` +
         `'${donor.name}' collides with own definition`
      );
   }
   if (recp.importedNames.has(importedAs)) {
      throw new Error(
         `Module '${recp.name}': the name '${importedAs}' imported more than once`
      );
   }
}
moduleEval ::= function (module, code) {
   let fun;

   try {
      fun = new Function('$_, $, $$', `"use strict"; return (${code});`);
   }
   catch (e) {
      console.error(`Parsing of this code failed: ${code}`);
      throw e;
   }

   try {
      return fun.call(null, $_, module.rtobj, module);
   }
   catch (e) {
      console.error(`Evaluation of this code failed: ${code}`);
      throw e;
   }
   
}
touchedModules ::= new Set
delmark ::= Object.create(null)
rtget ::= function (module, name) {
   if (name in module.delta) {
      let val = module.delta[name];
      return val === $.delmark ? undefined : val;
   }
   else {
      return module.rtobj[name];
   }
}
rtset ::= function (module, name, val) {
   module.delta[name] = val;
   $.touchedModules.add(module);
}
rtdel ::= function (module, name) {
   $.rtset(module, name, $.delmark);
}
rtflush ::= function () {
   for (let module of $.touchedModules) {
      for (let [name, val] of Object.entries(module.delta)) {
         if (val === $.delmark) {
            delete module.rtobj[name];
         }
         else {
            module.rtobj[name] = val;
         }
      }

      module.delta = Object.create(null);
   }
   
   $.touchedModules.clear();
}
rtdrop ::= function () {
   for (let module of $.touchedModules) {
      module.delta = Object.create(null);
   }

   $.touchedModules.clear();
}
