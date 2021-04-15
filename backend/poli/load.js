relation
   * as: rel
vector
   * as: vec
-----
nextModuleId ::= 1
modules ::= null
main ::= function (modules) {
   // modules :: [{name, lang, imports, body, $}]
   let Rmodules = new $.rel.Relation('byId', [
      {name: 'byId', prop: 'id'},
      {name: 'byName', prop: 'name'}
   ]);

   $.rel.addFacts(Rmodules, function* () {
      for (let module of modules) {
         let entries = new $.rel.Relation('byName', [{name: 'byName', prop: 'name'}]);
         let seqEntries = new $.vec.Vector();

         if (module.lang === 'js') {
            for (let [name, code] of module.body) {
               code = code.trim();
               
               $.rel.addFact(entries, {
                  name: name,
                  strDef: code,
                  def: code
               });
               $.vec.pushBack(seqEntries, name);
            }

            $.rel.freeze(entries);
            $.vec.freeze(seqEntries);
         }

         yield {
            id: $.nextModuleId++,
            name: module.name,
            lang: module.lang,
            entries: entries,
            seqEntries: seqEntries,
            $: module.$
         };
      }
   }.call(null));
   $.rel.freeze(Rmodules);

   $.modules = Rmodules;
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
