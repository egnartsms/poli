bootstrap
   hasOwnProperty
   imports
   makeModule
   modules
import
   connectedModulesOf
   importsFrom
   importsInto
   unimport
persist
   deleteObject
   deleteObjectProp
   setObjectProp
-----
addNewModule ::= function (moduleName) {
   if ($.hasOwnProperty($.modules, moduleName)) {
      throw new Error(`Module with the name "${moduleName}" already exists`);
   }

   $.setObjectProp($.modules, moduleName, $.makeModule(moduleName, []));
}
renameModule ::= function (module, newName) {
   if ($.hasOwnProperty($.modules, newName)) {
      throw new Error(`Module with the name "${module.anem}" already exists`);
   }

   $.setObjectProp($.modules, newName, module);
   $.deleteObjectProp($.modules, module.name);
   $.setObjectProp(module, 'name', newName);

   let affectedModules = new Set;
   for (let imp of $.imports) {
      if (imp.donor === module) {
         affectedModules.add(imp.recp);
      }
   }

   return affectedModules;
}
removeModule ::= function (module, force) {
   let cnmods = $.connectedModulesOf(module);
   
   if (cnmods.size > 0) {
      if (!force) {
         return Array.from(cnmods, mod => mod.name);
      }

      let imports = [...$.importsFrom(module), ...$.importsInto(module)];
      
      for (let imp of imports) {
         $.unimport(imp);
      }
   }

   $.deleteObject(module.importedNames);
   $.deleteObject(module.entries);
   $.deleteObject(module.defs);
   $.deleteObject(module);

   $.deleteObjectProp($.modules, module.name);

   return true;
}
