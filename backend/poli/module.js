bootstrap
   moduleEval
   rtset
common
   parameterize
exc
   rethrowCodeErrorsOn
xs-finalizer
   finalizeModuleEntry
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
      return $.dumpsNext(module.defs[entry].syntax, 0);
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
      let syntax = $.rethrowCodeErrorsOn(
         source,
         () => $.parameterize(
            [$.strictMode, true],
            () => $.readEntryDefinition(source)
         )
      );
      defn = {
         syntax: syntax
      };
      normalizedSource = $.dumpsNext(syntax, 0);

      // TODO: evaluate stx once you have XS compiler
   }
   else
      throw new Error;
   
   module.entries.splice(idx, 0, name);
   module.defs[name] = defn;

   return normalizedSource;
}
finalizeEntry ::= function (module, entry) {
   let def = module.defs[entry];
   
   let fin = $.finalizeModuleEntry(module, entry);
   console.log(fin);
   
}
