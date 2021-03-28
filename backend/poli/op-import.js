bootstrap
   modules
common
   joindot
import
   entryImportsFromTo
   importFromTo
   unimport
op-refactor
   renameImportedName
   renameRefsIn
reference
   isNameFree
   isReferredTo
transact
   propSet
-----
renameImport ::= function (imp, newAlias) {
   let recp = imp.recp;
   let oldName = $.importedAs(imp);
   let newName = newAlias || imp.name;

   if (oldName === newName) {
      return null;
   }
   if (imp.name === null && !newAlias) {
      throw new Error(`Module import ("${imp.donor.name}") is left unnamed`);
   }
   if (!$.isNameFree(recp, newName)) {
      throw new Error(`Cannot rename import to "${newName}": name already occupied`);
   }

   $.renameImportedName(recp, oldName, newName);
   $.propSet(imp, 'alias', newAlias);

   return $.renameRefsIn(recp, [oldName, newName]);
}
removeImport ::= function (imp, force) {
   let isUsed = $.isReferredTo(imp.recp, $.importedAs(imp));

   if (isUsed && !force) {
      return false;
   }

   $.unimport(imp);

   return true;
}
removeUnusedModuleImports ::= function (module) {
   let unused = [];
   
   for (let [as, entry] of module.imported) {
      if (!$.isReferredTo(module, as)) {
         unused.push(entry);
      }
   }
   
   for (let entry of unused) {
      $.unimport(entry, module);
   }

   return unused.length;
}
removeUnusedImportsInAllModules ::= function () {
   let modules = [];

   for (let module of Object.values($.modules)) {
      let unused = [];

      for (let [as, entry] of module.imported) {
         if (!$.isReferredTo(module, as)) {
            unused.push(entry);
         }
      }

      if (unused.length > 0) {
         modules.push([module, unused]);
      }
   }

   let count = 0;

   for (let [module, unused] of modules) {
      for (let entry of unused) {
         $.unimport(entry, module);
         count += 1;
      }
   }

   return {
      removedCount: count,
      affectedModules: Array.from(modules, pair => pair[0])
   };
}
convertImportsToStar ::= function (recp, donor) {
   let simp = $.importFromTo(donor, null, recp);
   if (simp === null) {
      throw new Error(`Module "${recp.name}" is not importing "${donor.name}"`);
   }

   let eimps = Array.from($.entryImportsFromTo(donor, recp));
   
   if (eimps.length === 0) {
      return null;
   }

   let rnmap = new Map;
   for (let imp of eimps) {
      rnmap.set($.importedAs(imp), $.joindot(simp.alias, imp.name));
   }

   let modifiedEntries = $.renameRefsIn(recp, rnmap);
   for (imp of eimps) {
      $.unimport(imp);
   }

   return modifiedEntries;
}
