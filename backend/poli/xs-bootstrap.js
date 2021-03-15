bootstrap
   addModuleInfoImports
   moduleEval
   modules
   rtflush
xs-codegen
   genCodeByFintree
xs-finalizer
   finalizeSyntax
xs-reader
   readEntryDefinition
-----
load ::= function (modulesInfo) {
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeXsModule(name, body);
   }
   
   for (let minfo of modulesInfo) {
      $.addModuleInfoImports(minfo);
   }
   
   $.rtflush();
}
makeXsModule ::= function (name, body) {
   let defs = {};

   for (let [entry, src] of body) {
      defs[entry] = {
         syntax: $.readEntryDefinition(src),
         fintree: null,
         jscode: null
      };
   }
   
   let module = {
      lang: 'xs',
      name: name,
      
      imports: new Set(),
      exports: new Set(),
      importedNames: new Set(),
      
      entries: Array.from(body, ([entry]) => entry),
      defs: defs,
      rtobj: Object.create(null),
      delta: Object.create(null)
   };
   
   for (let [entry, def] of Object.entries(defs)) {
      let fintree = $.finalizeSyntax(module, def.syntax);
      let jscode = $.genCodeByFintree(fintree);
      
      Object.assign(def, {fintree, jscode});
      module.rtobj[entry] = $.moduleEval(module, jscode);
   }
   
   return module;
}
