bootstrap
   moduleEval
common
   parameterize
   propagateValueToRecipients
exc
   rethrowCodeErrorsOn
transact
   DpropSet
   propSet
   splice
xs-codegen
   genCodeByFintree
xs-finalizer
   finalizeSyntax
xs-printer
   dumpsNext
xs-reader
   readEntryDefinition
xs-tokenizer
   strictMode
-----
entrySource ::= function (module, entry) {
   let def = module.defs[entry];
   
   if (module.lang === 'js') {
      return def;;
   }
   
   if (module.lang === 'xs') {
      return $.dumpsNext(def.syntax, 0);
   }
   
   throw new Error;
}
addEntry ::= function (module, entry, source, idx) {
   let {def, normalizedSource, val} =
      (module.lang === 'js') ?
         $.prepareEntryJs(module, source)
      : module.lang === 'xs' ?
         $.prepareEntryXs(module, source)
      : function () { throw new Error; }.call(null);
   
   $.splice(module.entries, idx, 0, entry);
   $.propSet(module.defs, entry, def);
   $.DpropSet(module.rtobj, entry, val);
   
   return normalizedSource;
}
editEntry ::= function (module, entry, newSource) {
   let {def, normalizedSource, val} =
      (module.lang === 'js') ?
         $.prepareEntryJs(module, newSource)
      : module.lang === 'xs' ?
         $.prepareEntryXs(module, newSource)
      : function () { throw new Error; }.call(null);
      
   $.propSet(module.defs, entry, def);
   $.DpropSet(module.rtobj, entry, val);
   $.propagateValueToRecipients(module, entry);
   
   return normalizedSource;
}
prepareEntryJs ::= function (module, source) {
   let trimmed = source.trim();

   return {
      def: trimmed,
      normalizedSource: trimmed,
      val: $.moduleEval(module, trimmed)
   };
}
prepareEntryXs ::= function (module, source) {
   let syntax = $.rethrowCodeErrorsOn(
      source,
      () => $.parameterize(
         [$.strictMode, true],
         () => $.readEntryDefinition(source)
      )
   );
   let fintree = $.finalizeSyntax(module, syntax);
   let jscode = $.genCodeByFintree(fintree);
   let val = $.moduleEval(module, jscode);
      
   return {
      def: {
         syntax,
         fintree,
         jscode
      },
      normalizedSource: $.dumpsNext(syntax, 0),
      val: val
   };
}
