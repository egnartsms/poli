bootstrap
   hasOwnProperty
   makeJsModule
   modules
import
   connectedModulesOf
   moduleRevDepsOf
   unimport
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

   $.modules[moduleName] = module;
}
renameModule ::= function (module, newName) {
   if ($.hasOwnProperty($.modules, newName)) {
      throw new Error(`Module with the name "${newName}" already exists`);
   }

   delete $.modules[module.name];
   $.modules[newName] = module;
   module.name = newName;

   return $.moduleRevDepsOf(module);
}
removeModule ::= function (module, force) {
   let cnmods = $.connectedModulesOf(module);
   
   if (cnmods.size > 0) {
      if (!force) {
         return Array.from(cnmods, mod => mod.name);
      }

      let imps = [...module.imports, ...module.exports];
      
      for (let imp of imps) {
         $.unimport(imp);
      }
   }

   delete $.modules[module.name];

   return true;
}
