bootstrap
   hasOwnProperty
   moduleEval
   saveObject
common
   propagateValueToRecipients
persist
   deleteObject
   setObjectProp
reference
   isNameFree
rtrec
   rtset
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
   $.setObjectProp(module.defs, name, {
      type: 'js',
      src: defn
   });
}
editEntry ::= function (module, name, newDefn) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Not found entry "${name}" in module "${moduleName}"`);
   }

   let newVal = $.moduleEval(module, newDefn);

   $.deleteObject(module.defs[name]);
   $.setObjectProp(module.defs, name, {
      type: 'js',
      src: newDefn
   });

   $.rtset(module, name, newVal);
   $.propagateValueToRecipients(module, name);
}
