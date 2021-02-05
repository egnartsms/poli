bootstrap
   modules
   skRuntimeKeys
xs-reader
   readEntryDefinition
-----
makeModulesByInfo ::= function (modulesInfo) {
   console.dir(modulesInfo, {depth: 3});
   
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeXsModule(name, body);
   }
}
makeXsModule ::= function (name, body) {
   let defs = {};

   for (let [entry, src] of body) {
      let stx = $.readEntryDefinition(src);

      console.log(entry);
      console.dir(stx, {depth: 8});

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
