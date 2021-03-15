bootstrap
   addModuleInfoImports
   modules
   rtflush
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
         syntax: $.readEntryDefinition(src)
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
      // TODO: this needs a compiler
      rtobj: Object.create(null),
      delta: Object.create(null)
   };

   return module;
}
