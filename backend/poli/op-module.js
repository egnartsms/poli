bootstrap
   hasOwnProperty
   makeJsModule
   modules
import
   connectedModulesOf
   moduleRevDepsOf
   unimport
transact
   propDel
   propSet
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

   $.propSet($.modules, moduleName, module);
}
renameModule ::= function (module, newName) {
   if ($.hasOwnProperty($.modules, newName)) {
      throw new Error(`Module with the name "${newName}" already exists`);
   }

   $.propDel($.modules, module.name);
   $.propSet($.modules, newName, module);
   $.propSet(module, 'name', newName);

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

   $.propDel($.modules, module.name);

   return true;
}
