bootstrap
   hasOwnProperty
   imports
   makeJsModule
   modules
   skRuntimeKeys
import
   connectedModulesOf
   importsFrom
   importsInto
   moduleRevDepsOf
   unimport
persist
   deleteObject
   deleteObjectProp
   setObjectProp
xs-bootstrap
   makeXsModule
-----
addNewModule ::= function (moduleName, lang) {
   if ($.hasOwnProperty($.modules, moduleName)) {
      throw new Error(`Module with the name "${moduleName}" already exists`);
   }
   
   let module;

   if (lang === 'js') {
      module = $.makeJsModule(moduleName, []);
   }
   else if (lang === 'xs') {
      module = $.makeXsModule(moduleName, []);
   }
   else {
      throw new Error(`Invalid lang: ${lang}`);
   }

   $.setObjectProp($.modules, moduleName, module);
}
renameModule ::= function (module, newName) {
   if ($.hasOwnProperty($.modules, newName)) {
      throw new Error(`Module with the name "${newName}" already exists`);
   }

   $.setObjectProp($.modules, newName, module);
   $.deleteObjectProp($.modules, module.name);
   $.setObjectProp(module, 'name', newName);

   return $.moduleRevDepsOf(module);
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
