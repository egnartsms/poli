bootstrap
   addModuleInfoImports
   moduleEval
   modules
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
}
makeXsModule ::= function (name, body) {
   let module = {
      lang: 'xs',
      name: name,
      
      imported: new Map,  // { importedAs -> <entry> }
      exported: new Map,  // { <entry> -> {<recp module> -> as} }
      
      entries: null,
      name2entry: null,
      starEntry: null,

      rtobj: Object.create(null)
   };
   
   module.starEntry = {
      name: null,
      def: '*',
      module: module
   };

   module.entries = Array.from(body, ([name, src]) => ({
      name: name,
      def: $.readEntryDefinition(src),
      module: module,
      fintree: null,
      jscode: null
   }));

   module.name2entry = new Map(Array.from(module.entries, e => [e.name, e]));

   for (let entry of module.entries) {
      let fintree = $.finalizeSyntax(module, entry.def);
      let jscode = $.genCodeByFintree(fintree);

      entry.fintree = fintree;
      entry.jscode = jscode;
      
      module.rtobj[entry.name] = $.moduleEval(module, jscode);
   }
   
   return module;
}
