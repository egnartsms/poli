bootstrap
   hasOwnProperty
   moduleEval
   saveObject
common
   propagateValueToRecipients
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

   if (anchor === null) {
      if (module.entries.length > 0) {
         throw new Error(`Anchor entry not provided`);
      }

      $.rtset(module, name, $.moduleEval(module, defn));
      module.entries.push(name);
   }
   else {
      let idx = module.entries.indexOf(anchor);
      if (idx === -1) {
         throw new Error(`Not found an entry "${anchor}"`);
      }

      $.rtset(module, name, $.moduleEval(module, defn));
      module.entries.splice(before ? idx : idx + 1, 0, name);
   }

   $.saveObject(module.entries);
   $.setObjectProp(module.defs, name, defn);
}
editEntry ::= function (module, name, newDefn) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Not found entry "${name}" in module "${module.name}"`);
   }

   // TODO: correct that when you have an XS compiler
   if (module.lang === 'js') {
      let newVal = $.moduleEval(module, newDefn);

      $.setObjectProp(module.defs, name, newDefn);
      $.rtset(module, name, newVal);
      $.propagateValueToRecipients(module, name);
      
      return null;
   }
   else if (module.lang === 'xs') {
      let stx = $.readEntryDefinition(newDefn);
      $.setObjectProp(module.defs, name, {
         stx: stx
      });
      
      return $.dumpsNext(stx, 0);
   }
   else {
      throw new Error;
   }

}
