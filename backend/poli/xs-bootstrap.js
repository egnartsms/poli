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
   
   module.entries = Array.from(body, ([name, src]) => {
      let syntax = $.readEntryDefinition(src);
      let fintree = $.finalizeSyntax(module, syntax);
      let jscode = $.genCodeByFintree(fintree);

      return {
         name: name,
         def: syntax,
         fintree,
         jscode
      };
   });

   module.name2entry = new Map(Array.from(module.entries, e => [e.name, e]));

   module.starEntry = {
      name: null,
      def: '*',
      module: module
   };

   for (let entry of module.entries) {
      module.rtobj[entry.name] = $.moduleEval(module, entry.jscode);
   }
   
   return module;
}
