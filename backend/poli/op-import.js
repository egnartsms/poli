bootstrap
   imports
   saveObject
common
   joindot
import
   addImport
   deleteImport
   entryImportsFromTo
   importedAs
   starImportFromTo
op-refactor
   renameImportedName
   renameRefsIn
persist
   setObjectProp
reference
   isNameFree
   isReferredTo
-----
doImport ::= function (imp) {
   $.addImport(imp);
   $.saveObject(imp.recp.importedNames);
   $.saveObject($.imports);
}
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
   $.setObjectProp(imp, 'alias', newAlias);

   return $.renameRefsIn(recp, [oldName, newName]);
}
removeImport ::= function (imp, force) {
   let isUsed = $.isReferredTo(imp.recp, $.importedAs(imp));

   if (isUsed && !force) {
      return false;
   }

   $.deleteImport(imp);
   $.saveObject(imp.recp.importedNames);
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
convertImportsToStar ::= function (recp, donor) {
   let simp = $.starImportFromTo(donor, recp);
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
      $.deleteImport(imp);
   }

   $.saveObject(recp.importedNames);
   $.saveObject($.imports);

   return modifiedEntries;
}
