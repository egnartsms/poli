bootstrap
   moduleEval
   saveObject
persist
   setObjectProp
rtrec
   rtset
xs-printer
   dumpsNext
xs-reader
   readEntryDefinition
-----
entrySource ::= function (module, entry) {
   if (module.lang === 'js') {
      return module.defs[entry];
   }
   
   if (module.lang === 'xs') {
      return $.dumpsNext(module.defs[entry].stx, 0);
   }
   
   throw new Error;
}
addEntry ::= function (module, name, source, idx) {
   let defn, normalizedSource;

   if (module.lang === 'js') {
      defn = normalizedSource = source.trim()
      
      $.rtset(module, name, $.moduleEval(module, source));
   }
   else if (module.lang === 'xs') {
      let stx = $.readEntryDefinition(source);
      defn = {
         stx: stx
      };
      normalizedSource = $.dumpsNext(stx, 0);

      // TODO: evaluate stx once you have XS compiler
   }
   else
      throw new Error;
   
   module.entries.splice(idx, 0, name);
   $.saveObject(module.entries);
   $.setObjectProp(module.defs, name, defn);

   return normalizedSource;
}
