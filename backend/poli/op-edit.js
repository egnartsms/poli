bootstrap
   hasOwnProperty
common
   entryByName
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
      let anchorEntry = module.name2entry.get(anchor);
      if (anchorEntry === undefined) {
         throw new Error(`Module '${module.name}': not found entry '${anchor}'`);
      }
      
      let idx = module.entries.indexOf(anchorEntry);
      targetIndex = before ? idx : idx + 1;
   }

   return $.module.addEntry(module, entry, source, targetIndex);
}
