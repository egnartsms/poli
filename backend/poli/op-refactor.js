bootstrap
   hasOwnProperty
   moduleEval
common
   iconcat
   joindot
   propagateValueToRecipients
import
   importsOf
   referrerImportsFromTo
   referrersOf
   unimport
reference
   isEntryUsed
   isNameFree
transact
   DpropDel
   DpropGet
   DpropSet
   arraySet
   mapDelete
   mapSet
   propSet
   setAdd
   setDelete
   splice
-----
renameImportedName ::= function (entry, recp, as, newName) {
   $.DpropSet(recp.rtobj, newName, $.DpropGet(recp.rtobj, as));
   $.DpropDel(recp.rtobj, as);
   $.mapDelete(recp.imported, as);
   $.mapSet(recp.imported, newName, entry);
}
offendingModulesOnRename ::= function (entry, newName) {
   let offendingModules = [];

   for (let {recp, as} of entry.module.exported.get(entry) || []) {
      if (as === entry.name && !$.isNameFree(recp, newName)) {
         offendingModules.push(recp);
      }
   }
   
   return offendingModules;
}
renameRefsIn ::= function (module, renameMap) {
   // TODO: implement reference renaming for XS
   if (module.lang === 'xs') {
      return [];
   }

   function escape(ref) {
      return ref.replace(/\./g, '\\.');
   }

   if (renameMap instanceof Array) {
      if (typeof renameMap[0] === 'string' && renameMap.length === 2) {
         renameMap = [renameMap];
      }
      renameMap = new Map(renameMap);
   }

   let alts = Array.from(renameMap.keys(), escape);

   if (alts.length === 0) {
      return [];
   }

   let re = new RegExp(`(?<=\\$\\.)(?:${alts.join('|')})\\b`, 'g');
   let modifiedEntries = [];

   for (let entry of module.entries) {
      let oldSource = entry.def;
      let newSource = oldSource.replace(re, ref => renameMap.get(ref));
      
      if (oldSource === newSource) {
         continue;
      }

      let newVal = $.moduleEval(module, newSource);

      $.propSet(entry, 'def', newSource);
      $.propagateValueToRecipients(entry, newVal);

      modifiedEntries.push([entry, newSource]);
   }

   return modifiedEntries;
}
modifyRecipientsForRename ::= function (entry, newName) {
   let exps = entry.module.exported.get(entry);
   let starExps = entry.module.exported.get(entry.module.starEntry);
   let result = new Map; // module -> <info>
   
   for (let [recp, as] of exps || []) {
      let rnmap = new Map;
      
      if (as === entry.name) {
         // if it was imported with no alias
         $.renameImportedName(entry, recp, as, newName);
         exps.set(recp, newName);
         rnmap.set(as, newName);
      }
      
      result.set(recp, {
         rnmap,
         importSectionAffected: true
      });
   }
   
   for (let [recp, as] of starExps || []) {
      let rnmap;
      
      if (result.has(recp)) {
         ({rnmap} = result.get(recp));
      }
      else {
         rnmap = new Map;
         result.set(recp, {
            rnmap,
            importSectionAffected: false
         });
      }
      
      rnmap.set($.joindot(as, entry.name), $.joindot(as, newName));
   }

   return Array.from(result, ([recp, {rnmap, importSectionAffected}]) => {
      let modifiedEntries = $.renameRefsIn(recp, rnmap);
      return {
         module: recp,
         modifiedEntries,
         importSectionAffected
      };
   });
}
renameEntry ::= function (entry, newName) {
   if (entry.name === newName) {
      return [];
   }
   if (!$.isNameFree(entry.module, newName)) {
      throw new Error(`Cannot rename to "${newName}": such an entry already ` +
                      `exists or imported`);
   }

   let offendingModules = $.offendingModulesOnRename(entry, newName);
   if (offendingModules.length > 0) {
      throw new Error(`Cannot rename to "${newName}": cannot rename imports in ` +
                      `modules: ${offendingModules.map(m => m.name).join(',')}`);
   }

   let modifiedModules = $.modifyRecipientsForRename(entry, newName);
   let modifiedEntries = $.renameRefsIn(entry.module, [entry.name, newName]);

   modifiedModules.unshift({
      module: entry.module,
      modifiedEntries,
      importSectionAffected: false
   });

   // See if the entry was recursive. If yes, then we should refer to it by its new name
   let ownPair = modifiedEntries.find(([name, code]) => name === entry.name);
   if (ownPair !== undefined) {
      ownPair[0] = newName;
   }
   
   $.DpropSet(entry.module.rtobj, newName, $.DpropGet(entry.module.rtobj, entry.name));
   $.DpropDel(entry.module.rtobj, entry.name);
   $.mapSet(entry.module.name2entry, newName, entry);
   $.mapDelete(entry.module.name2entry, entry.name);
   $.propSet(entry, 'name', newName);
   
   return modifiedModules;
}
replaceUsages ::= function (module, name, newName) {
   if ($.isNameFree(module, name)) {
      throw new Error(`Unknown name "${name}" in module ${module.name}`);
   }
   if ($.isNameFree(module, newName)) {
      throw new Error(`Unknown name "${newName}" in module ${module.name}`);
   }

   return $.renameRefsIn(module, [name, newName]);
}
removeEntry ::= function (module, entry, force) {
   if (!$.hasOwnProperty(module.defs, entry)) {
      throw new Error(`Entry named "${entry}" does not exist`);
   }

   if (!force && $.isEntryUsed(module, entry)) {
      return {
         removed: false
      }
   }

   // Delete any entry (direct) imports
   let imps = Array.from($.importsOf(module, entry));
   let recps = new Set(imps.map(imp => imp.recp));

   for (let imp of imps) {
      $.unimport(imp);
   }      

   $.splice(module.entries, module.entries.indexOf(entry), 1);
   $.propDel(module.defs, entry);
   $.DpropDel(module.rtobj, entry);

   return {
      removed: true,
      affectedModules: recps
   }
}
