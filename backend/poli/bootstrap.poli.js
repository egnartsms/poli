-----
modules ::= []
imports ::= new Set()
main ::= function () {
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
         entries = $.orderModuleEntries(entries, 'id', 'prev_id');
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

   for (let ri of rawImports) {
      let recp = moduleById[ri['recp_module_id']];
      let donor = moduleById[ri['donor_module_id']];

      $.importEntry(recp, donor, ri['name'], ri['alias']);
   }

   // Fill in $.modules (preserving identity of this array)
   for (let module of Object.values(moduleById)) {
      $.modules.push(module);
   }

   return Array.from($.modules);
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
orderModuleEntries ::= function (entries, propId, propPrevId) {
   /**
    Return an ordered array of module entries.

    Entries may be any objects for which the following must hold:

      entry[propId]: returns ID of an etry
      entry[propPrevId]: returns ID of the immediately preceding entry

    :param entries: array of items
    :param propId, propPrevId: property names to access respective IDs.
   */
   let id2prev = new Map;

   for (let entry of entries) {
      id2prev.set(entry[propId], entry[propPrevId]);
   }

   let ids = [];

   while (id2prev.size > 0) {
      let i = ids.length;
      let [id] = id2prev.keys();

      while (id2prev.has(id)) {
         ids.push(id);
         let prev = id2prev.get(id);
         id2prev.delete(id);
         id = prev;
      }

      // reverse part of array
      let j = ids.length - 1;
      while (i < j) {
         [ids[i], ids[j]] = [ids[j], ids[i]];
         i += 1;
         j -= 1;
      }
   }

   let id2item = new Map;
   for (let entry of entries) {
      id2item.set(entry[propId], entry);
   }

   return Array.from(ids, id => id2item.get(id));
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
      rtobj: (moduleData['name'] === $_.BOOTSTRAP_MODULE) ? $ : Object.create(null)
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

   if (name !== null && !(name in donor.defs)) {
      throw new Error(
         `Module "${recp.name}": cannot import "${name}" from "${donor.name}": no such `
         `definition`
      );
   }
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

   if (name === null) {
      // star import
      recp.rtobj[importedAs] = donor.rtobj;
   }
   else {
      // member import
      recp.rtobj[importedAs] = donor.rtobj[name];
   }

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
moduleEval ::= function (module, code) {
   let fun = new Function('$_, $, $$', `return (${code})`);
   return fun.call(null, $_, module.rtobj, module);
}
