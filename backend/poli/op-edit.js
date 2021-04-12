common
   hasOwnProperty
module
   * as: module
reference
   isNameFree
-----
addEntry ::= function (module, entry, source, anchor, before) {
   if (!$.isNameFree(module, entry)) {
      throw new Error(`"${entry}" already defined or imported`);
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

   return $.module.addEntry(module, entry, source, targetIndex);
}
editEntry ::= function (module, entry, newSource) {
   if (!$.hasOwnProperty(module.defs, entry)) {
      throw new Error(`Not found entry "${entry}" in module "${module.name}"`);
   }

   return $.module.editEntry(module, entry, newSource);
}
