bootstrap
   hasOwnProperty
   makeJsModule
   modules
import
   connectedModulesOf
   importsFrom
   importsInto
   moduleRevDepsOf
   unimport
persist
   markAsDirty
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

   $.markAsDirty($.modules);
   $.modules[moduleName] = module;
}
renameModule ::= function (module, newName) {
   if ($.hasOwnProperty($.modules, newName)) {
      throw new Error(`Module with the name "${newName}" already exists`);
   }

   $.markAsDirty($.modules);
   $.modules[newName] = module;
   delete $.modules[module.name];

   $.markAsDirty(module);
   module.name = newName;

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

   $.markAsDirty($.modules);
   delete $.modules[module.name];

   return true;
}
