bootstrap
   hasOwnProperty
   moduleEval
   saveObject
common
   propagateValueToRecipients
module
   * as: module
persist
   setObjectProp
reference
   isNameFree
rtrec
   rtset
xs-printer
   dumpsNext
xs-reader
   readEntryDefinition
-----
addEntry ::= function (module, name, defn, anchor, before) {
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

   return $.module.addEntry(module, name, defn, targetIndex);
}
editEntry ::= function (module, name, newDefn) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Not found entry "${name}" in module "${module.name}"`);
   }

   if (module.lang === 'js') {
      // For JS, we can (and should) trim the definition
      let newSrc = newDefn.trim();
      let newVal = $.moduleEval(module, newSrc);

      $.setObjectProp(module.defs, name, newSrc);
      $.rtset(module, name, newVal);
      $.propagateValueToRecipients(module, name);
      
      return newSrc;
   }
   else if (module.lang === 'xs') {
      let stx = $.readEntryDefinition(newDefn);

      $.setObjectProp(module.defs, name, {
         stx: stx
      });
      // TODO: compute the value when you finally have XS compiler
      
      return $.dumpsNext(stx, 0);
   }
   else {
      throw new Error;
   }
}
