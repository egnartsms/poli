bootstrap
   hasOwnProperty
   imports
   makeModule
   modules
persist
   deleteObject
   deleteObjectProp
   setObjectProp
run
   opRet
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
removeModule ::= function (module) {
   if (module.importedNames.size > 0 || module.entries.length > 0) {
      throw new Error(`Module "${module.name}" is not empty`);
   }

   $.deleteObject(module.importedNames);
   $.deleteObject(module.entries);
   $.deleteObject(module.defs);
   $.deleteObject(module);

   $.deleteObjectProp($.modules, module.name);

   $.opRet();
}
