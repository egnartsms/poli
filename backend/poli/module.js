bootstrap
   moduleEval
   rtset
common
   parameterize
exc
   rethrowCodeErrorsOn
xs-printer
   dumpsNext
xs-reader
   readEntryDefinition
xs-tokenizer
   strictMode
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
      defn = normalizedSource = source.trim();
      
      $.rtset(module, name, $.moduleEval(module, source));
   }
   else if (module.lang === 'xs') {
      let stx = $.rethrowCodeErrorsOn(
         source,
         () => $.parameterize(
            [$.strictMode, true],
            () => $.readEntryDefinition(source)
         )
      );
      defn = {
         stx: stx
      };
      normalizedSource = $.dumpsNext(stx, 0);

      // TODO: evaluate stx once you have XS compiler
   }
   else
      throw new Error;
   
   module.entries.splice(idx, 0, name);
   module.defs[name] = defn;

   return normalizedSource;
}
makeEntryDefinition ::= function (module, source) {
   // For XS: read 'source' with xs-reader and assoc srcloc info to syntax objects
   let stx = $.rethrowCodeErrorsOn(source, () => $.readEntryDefinition(source));
   
}
