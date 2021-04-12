common
   hasOwnProperty
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
-----
renameImportedName ::= function (recp, oldName, newName) {
   $.rtset(recp, newName, $.rtget(recp, oldName));
   $.rtdel(recp, oldName);

   recp.importedNames.delete(oldName);
   recp.importedNames.add(newName);
}
offendingModulesOnRename ::= function (module, oldName, newName) {
   let offendingModules = [];

   for (let imp of $.importsOf(module, oldName)) {
      if (imp.alias === null && !$.isNameFree(imp.recp, newName)) {
         offendingModules.push(imp.recp);
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
      let oldSource = module.defs[entry];
      let newSource = oldSource.replace(re, ref => renameMap.get(ref));
      
      if (oldSource === newSource) {
         continue;
      }

      let newVal = $.moduleEval(module, newSource);

      module.defs[entry] = newSource;
      $.rtset(module, entry, newVal);
      $.propagateValueToRecipients(module, entry);

      modifiedEntries.push([entry, newSource]);
   }

   return modifiedEntries;
}
modifyRecipientsForRename ::= function (module, oldName, newName) {
   let referrers = $.referrersOf(module, oldName);
   let modifiedModules = [];

   for (let referrer of referrers) {
      let rnmap = new Map;
      let {eimp, simp} = $.referrerImportsFromTo(module, oldName, referrer);

      if (eimp) {
         if (eimp.alias === null) {
            $.renameImportedName(eimp.recp, oldName, newName);
            rnmap.set(oldName, newName);
         }
         eimp.name = newName;
      }
      if (simp) {
         rnmap.set($.joindot(simp.alias, oldName), $.joindot(simp.alias, newName));
      }

      let modifiedEntries = $.renameRefsIn(referrer, rnmap);
      modifiedModules.push({
         module: referrer,
         modifiedEntries,
         importSectionAffected: !!eimp
      });
   }

   return modifiedModules;
}
renameEntry ::= function (module, oldName, newName) {
   if (!$.hasOwnProperty(module.defs, oldName)) {
      throw new Error(`Did not find an entry named "${oldName}"`);
   }
   if (oldName === newName) {
      return [];
   }
   if (!$.isNameFree(module, newName)) {
      throw new Error(`Cannot rename to "${newName}": such an entry already ` +
                      `exists or imported`);
   }

   let offendingModules = $.offendingModulesOnRename(module, oldName, newName);
   if (offendingModules.length > 0) {
      throw new Error(`Cannot rename to "${newName}": cannot rename imports in ` +
                      `modules: ${offendingModules.map(m => m.name).join(',')}`);
   }

   let modifiedModules = $.modifyRecipientsForRename(module, oldName, newName);
   let modifiedEntries = $.renameRefsIn(module, [oldName, newName]);

   modifiedModules.unshift({
      module,
      modifiedEntries,
      importSectionAffected: false
   });

   // See if the entry was recursive. If yes, then we should refer to it by its new name
   let ownPair = modifiedEntries.find(([entry, code]) => entry === oldName);
   if (ownPair != null) {
      ownPair[0] = newName;
   }

   module.entries[module.entries.indexOf(oldName)] = newName;
   module.defs[newName] = module.defs[oldName];
   delete module.defs[oldName];

   $.rtset(module, newName, $.rtget(module, oldName));
   $.rtdel(module, oldName);

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

   module.entries.splice(module.entries.indexOf(entry), 1);
   delete module.defs[entry];
   $.rtdel(module, entry);

   return {
      removed: true,
      affectedModules: recps
   }
}
