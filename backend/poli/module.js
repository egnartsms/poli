bootstrap
   moduleEval
common
   parameterize
   propagateValueToRecipients
exc
   rethrowCodeErrorsOn
reference
   isNameFree
transact
   DpropSet
   propSet
   propAssign
   splice
   mapSet
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
entrySource ::= function (entry) {
   if (entry.module.lang === 'js') {
      return entry.def;
   }
   
   if (entry.module.lang === 'xs') {
      return $.dumpsNext(entry.def, 0);
   }
   
   throw new Error;
}
targetIndex ::= function (module, anchor, before) {
   if (anchor === null) {
      if (module.entries.length > 0) {
         throw new Error(`Anchor entry is malspecified`);
      }

      return 0;
   }
   else {
      let anchorEntry = module.name2entry.get(anchor);
      if (anchorEntry === undefined) {
         throw new Error(
            `Module '${module.name}': not found the anchor entry '${anchor}'`
         );
      }
      
      let idx = module.entries.indexOf(anchorEntry);
      return before ? idx : idx + 1;
   }
}
addEntry ::= function (module, name, source, idx) {
   if (!$.isNameFree(module, name)) {
      throw new Error(
         `Module '${module.name}': '${name}' already defined or imported`
      );
   }

   let {props, normalizedSource, val} =
      (module.lang === 'js') ?
         $.prepareJsEntry(module, source)
      : module.lang === 'xs' ?
         $.prepareXsEntry(module, source)
      : function () { throw new Error; }.call(null);
   
   let entry = {
      name: name,
      module: module,
      ...props
   };

   $.splice(module.entries, idx, 0, entry);
   $.mapSet(module.name2entry, name, entry);
   $.DpropSet(module.rtobj, name, val);
   
   return normalizedSource;
}
editEntry ::= function (entry, newSource) {
   let {props, normalizedSource, val} =
      (entry.module.lang === 'js') ?
         $.prepareJsEntry(entry.module, newSource)
      : entry.module.lang === 'xs' ?
         $.prepareXsEntry(entry.module, newSource)
      : function () { throw new Error; }.call(null);
      
   $.propAssign(entry, props);
   $.propagateValueToRecipients(entry, val);
   
   return normalizedSource;
}
prepareJsEntry ::= function (module, source) {
   let trimmed = source.trim();

   return {
      normalizedSource: trimmed,
      val: $.moduleEval(module, trimmed),
      props: {
         def: trimmed
      }
   };
}
prepareXsEntry ::= function (module, source) {
   let syntax = $.rethrowCodeErrorsOn(
      source,
      () => $.parameterize(
         [$.strictMode, true],
         () => $.readEntryDefinition(source)
      )
   );
   let fintree = $.finalizeSyntax(module, syntax);
   let jscode = $.genCodeByFintree(fintree);
   
   return {
      normalizedSource: $.dumpsNext(syntax, 0),
      val: $.moduleEval(module, jscode),
      props: {
         def: syntax,
         fintree: fintree,
         jscode: jscode
      }
   };
}
