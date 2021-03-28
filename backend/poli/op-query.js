bootstrap
   modules
common
   joindot
   moduleNames
import
   importFor
   importsOf
reference
   resolveReference
-----
allModuleNames ::= function () {
   return Object.keys($.modules);
}
allEntries ::= function () {
   let res = [];

   for (let module of Object.values($.modules)) {
      for (let entry of module.entries) {
         res.push([module.name, entry.name]);
      }
   }

   return res;
}
importablesInto ::= function (recp) {
   function encodeEntry(entry) {
      return JSON.stringify([entry.module.name, entry.name]);
   }

   function decodeEntry(encoded) {
      return JSON.parse(encoded);
   }

   let importables = new Set;

   for (let moduleName in $.modules) {
      let module = $.modules[moduleName];
      if (module === recp) {
         continue;
      }

      for (let e of module.entries) {
         importables.add(encodeEntry(e));
      }
      importables.add(encodeEntry(module.starEntry));
   }

   // Exclude those already imported
   for (let entry of recp.imported.values()) {
      importables.delete(encodeEntry(entry));
   }

   return Array.from(importables, decodeEntry);
}
findReferences ::= function (module, star, name) {
   let {
      found,
      module: oModule,
      name: oName
   } = $.resolveReference(module, star, name);

   if (!found) {
      return null;
   }

   let res = [[oModule.name, oName]];

   for (let imp of $.importsOf(oModule, oName)) {
      res.push([imp.recp.name, $.importedAs(imp)]);
   }

   for (let imp of $.importsOf(oModule, null)) {
      res.push([imp.recp.name, $.joindot(imp.alias, oName)])
   }

   res.sort(([m1, n1], [m2, n2]) => m1 < m2 ? -1 : m1 > m2 ? 1 : 0);

   return res;
}
getCompletions ::= function (module, star, prefix) {
   let targetModule;

   if (star !== null) {
      let simp = $.importFor(module, star);
      if (!simp || simp.name !== null) {
         return [];
      }
      targetModule = simp.donor;
   }
   else {
      targetModule = module;
   }

   let res = [];

   for (let name of $.moduleNames(targetModule)) {
      if (name.startsWith(prefix)) {
         res.push(name);
      }
   }

   return res;
}
