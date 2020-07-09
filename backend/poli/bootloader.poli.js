-----
modules ::= []
imports ::= []
_init ::= function () {
   let moduleData = $.indexBy(
      $_.db.prepare(`SELECT id, name FROM module`).all(), 
      'id'
   );

   let moduleById = $.buildObjectMap(function *() {
      let rawEntries = $_.db.prepare(`
         SELECT module_id, id, prev_id, name, def
         FROM entry
         ORDER BY module_id ASC`
      ).all();

      for (let [id, entries] of $.groupSortedBy(rawEntries, 'module_id')) {
         entries = $_.orderModuleEntries(entries, 'id', 'prev_id');
         yield [id, $.makeModuleObject(moduleData[id], entries)];
      }
   }); 

   let rawImports = $_.db.prepare(`
      SELECT
         import.recp_module_id,
         entry.module_id AS donor_module_id,
         entry.name AS name,
         import.alias AS alias
      FROM import
         INNER JOIN entry ON entry.id = import.donor_entry_id

      UNION ALL
      
      SELECT
         recp_module_id,
         donor_module_id,
         NULL AS name,
         alias
      FROM star_import`
   ).all();

   let imports = [];

   for (let ri of rawImports) {
      let recp = moduleById[ri['recp_module_id']];
      let donor = moduleById[ri['donor_module_id']];

      let importedAs = ri['alias'] || ri['name'];

      if (importedAs in recp.defs) {
         throw new Error(
            `Module "${recp.name}": cannot import "${importedAs}" from the module `
            `"${donor.name}": the name collides with own definition`
         );
      }
      if (recp.importedNames.has(importedAs)) {
         throw new Error(
            `Module "${recp.name}": the name "${importedAs}" imported from multiple `
            `modules`
         );         
      }

      recp.importedNames.add(importedAs);

      if (ri['name'] === null) {
         // star import
         recp.rtobj[importedAs] = donor.rtobj;
      }
      else {
         // member import
         recp.rtobj[importedAs] = donor.rtobj[ri['name']];
      }

      imports.push({
         recp,
         alias: ri['alias'],
         get importedAs() {
            return this.alias || this.name;
         },
         donor,
         name: ri['name']
      });
   }

   // Fill in module-level members (important to preserve identities)
   Object.values(moduleById).forEach(m => $.modules.push(m));
   imports.forEach(i => $.imports.push(i));

   // Finally redirect to main's _init()
   let main = $.modules.find(m => m.name === 'main');
   main.rtobj._init();
}
groupSortedBy ::= function* (items, prop) {
   let fakePropval = Object.create(null);
   let propval = fakePropval;
   let group = [];

   for (let item of items) {
      if (item[prop] !== propval) {
         if (propval !== fakePropval) {
            yield [propval, group];
         }
         propval = item[prop];
         group = [];
      }

      group.push(item);
   }

   if (propval !== fakePropval) {
      yield [propval, group];
   }
}
indexBy ::= function (items, prop) {
   let res = Object.create(null);

   for (let item of items) {
      res[item[prop]] = item;
   }

   return res;
}
buildObjectMap ::= function (gen) {
   let objmap = Object.create(null);
   for (let [key, val] of gen()) {
      objmap[key] = val;
   }
   return objmap;
}
makeModuleObject ::= function (moduleData, entries) {
   let defs = Object.create(null);

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      defs[name] = def;
   }

   let module = {
      id: moduleData['id'],
      name: moduleData['name'],
      importedNames: new Set(),  // filled in on import resolve
      entries: Array.from(entries, e => e['name']),
      defs: defs,
      rtobj: (moduleData['id'] === $_.BOOTLOADER_MODULE_ID) ? $ : Object.create(null)
   };

   if (moduleData['id'] === $_.BOOTLOADER_MODULE_ID) {
      return module;
   }

   for (let {name} of entries) {
      module.rtobj[name] = $.moduleEval(module, defs[name].src);
   }

   return module;
}
moduleEval ::= function (module, code) {
   let fun = new Function('$_, $, $$', `return (${code})`);
   return fun.call(null, $_, module.rtobj, module);
}
