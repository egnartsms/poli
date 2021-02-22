bootstrap
   hasOwnProperty
   moduleEval
common
   propagateValueToRecipients
module
   * as: module
persist
   markAsDirty
reference
   isNameFree
rtrec
   rtset
xs-printer
   dumpsNext
xs-reader
   readEntryDefinition
-----
addEntry ::= function (module, name, source, anchor, before) {
   if (!$.isNameFree(module, name)) {
      throw new Error(`"${name}" already defined or imported`);
   }

   let targetIndex;

   if (anchor === null) {
      if (module.entries.length > 0) {
         throw new Error(`Anchor entry not provided`);
      }

      targetIndex = 0;
   }
   else {
      let idx = module.entries.indexOf(anchor);
      if (idx === -1) {
         throw new Error(`Not found an entry "${anchor}"`);
      }

      targetIndex = before ? idx : idx + 1;
   }

   return $.module.addEntry(module, name, source, targetIndex);
}
editEntry ::= function (module, name, newSource) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Not found entry "${name}" in module "${module.name}"`);
   }

   let normalizedSource;

   if (module.lang === 'js') {
      // For JS, we can (and should) trim the definition
      normalizedSource = newSource.trim();
      let newVal = $.moduleEval(module, normalizedSource);

      $.markAsDirty(module.defs);
      module.defs[name] = normalizedSource;
      $.rtset(module, name, newVal);
      $.propagateValueToRecipients(module, name);
   }
   else if (module.lang === 'xs') {
      let stx = $.readEntryDefinition(newSource);

      // TODO: compute the value when you finally have XS compiler
      $.markAsDirty(module.defs);
      module.defs[name] = {
         stx: stx
      };
      normalizedSource = $.dumpsNext(stx, 0);
   }
   else {
      throw new Error;
   }
   
   return normalizedSource;
}
