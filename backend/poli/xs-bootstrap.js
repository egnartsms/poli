bootstrap
   addModuleInfoImports
   effectuateImports
   modules
   skRuntimeKeys
xs-reader
   readEntryDefinition
-----
assert ::= $_.require('assert').strict
makeModulesByInfo ::= function (modulesInfo) {
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeXsModule(name, body);
   }
   
   for (let minfo of modulesInfo) {
      $.addModuleInfoImports(minfo);
   }
   
   $.effectuateImports('xs');
}
makeXsModule ::= function (name, body) {
   let defs = {};

   for (let [entry, src] of body) {
      let stx = $.readEntryDefinition(src);

      defs[entry] = {
         stx: stx
      };
   }
   
   let module = {
      [$.skRuntimeKeys]: ['rtobj'],
      lang: 'xs',
      name: name,
      importedNames: new Set(),
      entries: Array.from(body, ([entry]) => entry),
      defs: defs,
      rtobj: null
   };

   $.evalXsModuleDefinitions(module);

   return module;
}
evalXsModuleDefinitions ::= function (module) {
   $.assert(module.lang === 'xs');
   $.assert(module.rtobj === null);

   // TODO: this needs a compiler
   module.rtobj = Object.create(null);
}
animateXsModules ::= function () {
   for (let module of Object.values($.modules)) {
      if (module.lang === 'xs') {
         $.evalXsModuleDefinitions(module);
      }
   }

   $.effectuateImports('xs');
}
