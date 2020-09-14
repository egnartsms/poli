bootstrap
   imports
   saveObject
import
   deleteImport
   importFor
   importedAs
op-rename-entry
   renameImportedName
   renameRefsIn
persist
   setObjectProp
reference
   isNameFree
   isReferredTo
-----
renameImport ::= function (imp, newAlias) {
   let recp = imp.recp;
   let oldName = $.importedAs(imp);
   let newName = newAlias || imp.name;

   if (imp.name === null && !newAlias) {
      throw new Error(`Module import ("${imp.donor.name}") is left unnamed`);
   }
   if (!$.isNameFree(recp, newName)) {
      throw new Error(`Cannot rename import to "${newName}": name already occupied`);
   }

   $.renameImportedName(recp, oldName, newName);
   $.setObjectProp(imp, 'alias', newAlias || null);
   return $.renameRefsIn(recp, [oldName, newName]);
}
removeImport ::= function (module, importedAs, force) {
   let imp = $.importFor(module, importedAs);
   if (!imp) {
      throw new Error(`Not found imported entry: "${importedAs}"`);
   }

   let isUsed = $.isReferredTo(module, importedAs);

   if (isUsed && !force) {
      return false;
   }

   $.deleteImport(imp);
   $.saveObject(module.importedNames);
   $.saveObject($.imports);

   return true;
}
removeUnusedModuleImports ::= function (module) {
   let unused = [];

   for (let imp of $.imports) {
      if (imp.recp === module && !$.isReferredTo(module, $.importedAs(imp))) {
         unused.push(imp);
      }
   }

   for (let imp of unused) {
      $.deleteImport(imp);
   }

   if (unused.length > 0) {
      $.saveObject(module.importedNames);
      $.saveObject($.imports);
   }

   return unused.length;
}
removeUnusedImportsInAllModules ::= function () {
   let unused = [];
   let recps = new Set;

   for (let imp of $.imports) {
      if (!$.isReferredTo(imp.recp, $.importedAs(imp))) {
         unused.push(imp);
         recps.add(imp.recp);
      }
   }

   for (let imp of unused) {
      $.deleteImport(imp);
   }

   if (unused.length > 0) {
      for (let recp of recps) {
         $.saveObject(recp.importedNames);
      }
      $.saveObject($.imports);
   }

   return {
      removedCount: unused.length,
      affectedModules: recps
   };
}
