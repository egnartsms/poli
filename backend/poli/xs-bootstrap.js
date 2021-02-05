bootstrap
   modules
   skRuntimeKeys
xs-reader
   readEntryDefinition
-----
makeModulesByInfo ::= function (modulesInfo) {
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeXsModule(name, body);
   }
}
makeXsModule ::= function (name, body) {
   let defs = {};

   for (let [entry, src] of body) {
      let stx = $.readEntryDefinition(src);

      defs[entry] = {
         stx: stx
      };
   }
   
   return {
      [$.skRuntimeKeys]: ['rtobj'],
      lang: 'xs',
      name: name,
      importedNames: new Set(),  // filled in on import resolve
      entries: Array.from(body, ([entry]) => entry),
      defs: defs,
      // TODO: this needs a compiler
      rtobj: null
   };
}
