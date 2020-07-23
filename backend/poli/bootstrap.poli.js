-----
modules ::= Object.create(null)
imports ::= new Set()
main ::= function () {
   let moduleNames = $_.db.prepare(`SELECT name FROM module`).pluck().all();
   let stmtEntries = $_.db.prepare(`
      SELECT name, def, prev
      FROM entry
      WHERE module_name = :module_name
   `);

   for (let moduleName of moduleNames) {
      let entries = stmtEntries.all({module_name: moduleName});
      entries = $.orderModuleEntries(entries, 'name', 'prev');
      $.modules[moduleName] = $.makeModuleObject(moduleName, entries);
   }

   let imports = $_.db.prepare(`SELECT * FROM any_import`).all();

   for (let {
            recp_module_name,
            donor_module_name,
            name,
            alias
         } of imports) {
      let recp = $.modules[recp_module_name];
      let donor = $.modules[donor_module_name];

      if (name === null) {
         $.importModule(recp, donor, alias);
      }
      else {
         $.importEntry(recp, donor, name, alias);
      }
   }

   return Object.values($.modules);
}
orderModuleEntries ::= function (entries, propId, propPrevId) {
   /**
    Return an ordered array of module entries.

    Entries may be any objects for which the following holds:

      entry[propId]: returns ID of an etry
      entry[propPrevId]: returns ID of the immediately preceding entry

    :param entries: array of items
    :param propId, propPrevId: property names to access respective IDs.
   */
   let prev2entry = new Map;

   for (let entry of entries) {
      prev2entry.set(entry[propPrevId], entry);
   }

   let entry = prev2entry.get(null);
   if (entry == null) {
      return [];
   }

   let ordered = [];

   while (entry != null) {
      ordered.push(entry);
      entry = prev2entry.get(entry[propId]);
   }

   return ordered;
}
makeModuleObject ::= function (moduleName, entries) {
   /**
    * entries - DB records (module entries) already in the right order
   */
   let defs = Object.create(null);

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      defs[name] = def;
   }

   let module = {
      name: moduleName,
      importedNames: new Set(),  // filled in on import resolve
      entries: Array.from(entries, e => e['name']),
      defs: defs,
      rtobj: (moduleName === $_.BOOTSTRAP_MODULE) ? $ : Object.create(null)
   };

   if (module.rtobj === $) {
      return module;
   }

   for (let {name} of entries) {
      module.rtobj[name] = $.moduleEval(module, defs[name].src);
   }

   return module;
}
importEntry ::= function (recp, donor, name, alias) {
   let importedAs = alias || name;

   if (!(name in donor.defs)) {
      throw new Error(
         `Module "${recp.name}": cannot import "${name}" from "${donor.name}": ` +
         `no such definition`
      );
   }
   if (importedAs in recp.defs) {
      throw new Error(
         `Module "${recp.name}": cannot import "${importedAs}" from the module ` +
         `"${donor.name}": the name collides with own definition`
      );
   }
   if (recp.importedNames.has(importedAs)) {
      throw new Error(
         `Module "${recp.name}": the name "${importedAs}" imported from multiple ` +
         `modules`
      );         
   }

   recp.importedNames.add(importedAs);
   recp.rtobj[importedAs] = donor.rtobj[name];

   $.imports.add({
      recp,
      donor,
      name,
      alias,
      get importedAs() {
         return this.alias || this.name
      }
   });
}
importModule ::= function (recp, donor, alias) {
   if (alias in recp.defs) {
      throw new Error(
         `Module "${recp.name}": cannot import "${donor.name}" as "${alias}": ` +
         `the name collides with own definition`
      );
   }
   if (recp.importedNames.has(alias)) {
      throw new Error(
         `Module "${recp.name}": the name "${alias}" imported from multiple modules`
      );
   }

   recp.importedNames.add(alias);
   recp.rtobj[alias] = donor.rtobj;

   $.imports.add({
      recp,
      donor,
      name: null,
      alias,
      get importedAs() {
         return this.alias;
      }
   })
}
moduleEval ::= function (module, code) {
   let fun = new Function('$_, $, $$', `return (${code})`);
   return fun.call(null, $_, module.rtobj, module);
}
