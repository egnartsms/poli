bootstrap
   hasOwnProperty
   imports
   moduleEval
   saveObject
common
   dumpImportSection
   joindot
import
   addImport
   deleteImport
   importFromTo
   importedAs
   referabilityImports
   starImportFromTo
op-rename-entry
   renameRefsIn
persist
   deleteObject
   deleteObjectProp
   setObjectProp
reference
   extractRefs
   isNameFree
   isReferredTo
   referrerModules
   resolveReference
   whereNameCame
rt-rec
   delmark
   rtset
-----
moveBy1 ::= function (module, name, direction) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Entry named "${name}" does not exist`);
   }

   if (direction !== 'up' && direction !== 'down') {
      throw new Error(`Invalid direction name: "${direction}"`);
   }

   let i = module.entries.indexOf(name);
   let j = direction === 'up' ?
            (i === 0 ? module.entries.length - 1 : i - 1) :
            (i === module.entries.length - 1 ? 0 : i + 1);

   module.entries.splice(i, 1);
   module.entries.splice(j, 0, name);
   $.saveObject(module.entries);
}
moveEntry ::= function (srcModule, entry, destModule, anchor, before) {
   if (srcModule === destModule) {
      throw new Error(`Cannot move inside a single module`);
   }
   if (!$.hasOwnProperty(srcModule.defs, entry)) {
      throw new Error(`Entry "${entry}" does not exist in "${srcModuleName}"`);
   }

   if (anchor === null) {
      if (destModule.entries.length > 0) {
         throw new Error(`Anchor entry is null but the destination module is not empty`);
      }
   }
   else if (typeof anchor === 'string' && !$.hasOwnProperty(destModule.defs, anchor)) {
      throw new Error(`Anchor entry "${anchor}" does not exist in "${destModuleName}"`);
   }

   if (!$.isNameFree(destModule, entry)) {
      // There may actually be an import of entry from src into dest, in which case it
      // must be possible to move the entry (just delete the import)
      let imp = $.importFromTo(srcModule, entry, destModule);
      if (!(imp && $.importedAs(imp) === entry)) {
         throw new Error(`Cannot move entry because of name clash`);
      }
   }

   let fwd = $.computeForwardModificationsOnMoveEntry(srcModule, entry, destModule);
   let bwd = $.computeBackwardModificationsOnMoveEntry(srcModule, entry, destModule);

   if (fwd.offendingRefs.length > 0 || bwd.blockingReferrers.length > 0) {
      return {
         moved: false,
         offendingRefs: fwd.offendingRefs,
         blockingReferrers: bwd.blockingReferrers.map(m => m.name)
      };
   }

   // Stage 1. Delete imports
   for (let imp of bwd.importsToRemove) {
      $.deleteImport(imp);
      $.saveObject(imp.recp.importedNames);
   }

   // Stage 2. Take out srcModule[entry] definition
   let defn = srcModule.defs[entry];
   $.deleteObjectProp(srcModule.defs, entry);
   $.rtset(srcModule, entry, $.delmark);

   srcModule.entries.splice(srcModule.entries.indexOf(entry), 1);
   $.saveObject(srcModule.entries);

   // Stage 3. Modify modules (do rename in definitions)
   let modifiedModules = new Map;
   for (let {module, rnmap} of bwd.defnRenames) {
      let modifiedEntries = $.renameRefsIn(module, rnmap);
      if (modifiedEntries.length > 0) {
         modifiedModules.set(module, modifiedEntries);
      }
   }

   // Stage 4. Install new definition into destModule
   let newCode;

   if (fwd.renameMap.size > 0) {
      let alts = 
         Array.from(fwd.renameMap.keys(), r => `(?:${r.replace(/\./g, '\\.')})`)
         .join('|');
      let sre = `(?<=\\$\\.)${alts}`;
      let re = new RegExp(sre, 'g');

      newCode = defn.src.replace(re, ref => fwd.renameMap.get(ref));
   }
   else {
      newCode = defn.src;
   }

   let newVal = $.moduleEval(destModule, newCode);
   $.rtset(destModule, entry, newVal);
   if (newCode !== defn.src) {
      $.deleteObject(defn);
      defn = {
         type: 'native',
         src: newCode
      };
   }
   $.setObjectProp(destModule.defs, entry, defn);

   let iAnchor;

   if (anchor === null) {
      iAnchor = 0;
   }
   else if (anchor === false) {
      iAnchor = 0;
   }
   else if (anchor === true) {
      iAnchor = destModule.entries.length;
   }
   else {
      iAnchor = destModule.entries.indexOf(anchor);
      iAnchor = before ? iAnchor : iAnchor + 1;
   }
   
   destModule.entries.splice(iAnchor, 0, entry);
   $.saveObject(destModule.entries);

   // Stage 5. Add imports
   for (let imp of [...fwd.importsToAdd, ...bwd.importsToAdd]) {
      $.addImport(imp);
      $.saveObject(imp.recp.importedNames);
   }

   $.saveObject($.imports);

   let importSectionAffected = bwd.importSectionAffected;
   if (fwd.importsToAdd.length > 0) {
      importSectionAffected.add(destModule);
   }

   let modulesToReport = new Set([...modifiedModules.keys(), ...importSectionAffected]);

   return {
      moved: true,
      danglingRefs: fwd.danglingRefs,
      newCode: newCode,
      modifiedModules: Array.from(modulesToReport, module => ({
         module: module.name,
         importSection:
            importSectionAffected.has(module) ? $.dumpImportSection(module) : null,
         modifiedEntries: modifiedModules.get(module) || null
      }))
   };
}
computeForwardModificationsOnMoveEntry ::= function (srcModule, entry, destModule) {
   let refs = $.extractRefs(srcModule, entry);
   
   let offendingRefs = [];
   let danglingRefs = [];
   let renameMap = new Map;
   let importsToAdd = [];

   function rename(from, to) {
      if (from !== to) {
         renameMap.set(from, to);
      }
   }

   function splitRef(ref) {
      let pref = ref.split('.');
      let refModule, refName;

      if (pref.length === 1) {
         pref.unshift(null);
      }
   
      return pref;
   }

   for (let ref of refs) {
      let [refStar, refName] = splitRef(ref);
      let {
         found,
         module: oModule,
         name: oEntry,
         reduced: wasRefReduced
      } = $.resolveReference(srcModule, refStar, refName);

      if (!found) {
         danglingRefs.push(ref);
         continue;
      }

      if (wasRefReduced) {
         ref = refStar;
         refName = refStar;
      }

      if (oModule === destModule) {
         // The reference "comes home"
         rename(ref, oEntry);
         continue;
      }

      // See whether the entry is already imported directly
      let {eimp, simp} = $.referabilityImports(oModule, oEntry, destModule);

      if (eimp) {
         rename(ref, $.importedAs(eimp));
         continue;
      }

      // If not imported directly then the oModule may have already been star-imported
      if (simp) {
         rename(ref, $.joindot(simp.alias, oEntry));
         continue;
      }

      // Must import it directly then
      if ($.isNameFree(destModule, refName)) {
         importsToAdd.push({
            recp: destModule,
            donor: oModule,
            name: oEntry,
            alias: refName === oEntry ? null : refName
         });
      }
      else {
         offendingRefs.push(ref);
      }
   }

   return {
      offendingRefs,
      danglingRefs,
      renameMap,
      importsToAdd
   };
}
computeBackwardModificationsOnMoveEntry ::= function (srcModule, entry, destModule) {
   let referrers = $.referrerModules(srcModule, entry);

   let destIsReferrerToo = referrers.has(destModule);
   referrers.delete(destModule);

   let blockingReferrers = [];
   let defnRenames = [];
   let importsToAdd = [];
   let importsToRemove = [];
   let importSectionAffected = new Set;

   for (let recp of referrers) {
      let {eimp, simp} = $.referabilityImports(srcModule, entry, recp);

      if (eimp) {
         importsToRemove.push(eimp);
         importsToAdd.push({...eimp, donor: destModule});
         importSectionAffected.add(recp);
      }

      if (simp) {
         let simpd = $.starImportFromTo(destModule, recp);
         if (simpd) {
            defnRenames.push({
               module: recp,
               rnmap: [$.joindot(simp.alias, entry), $.joindot(simpd.alias, entry)]
            });
         }
         else if (eimp) {
            defnRenames.push({
               module: recp,
               rnmap: [$.joindot(simp.alias, entry), $.importedAs(eimp)]
            });
         }
         else if ($.isReferredTo(recp, $.joindot(simp.alias, entry))) {
            blockingReferrers.push(recp);
         }
         // If not used through star import, do nothing
      }
   }

   // Examine destModule
   if (destIsReferrerToo) {
      let {eimp, simp} = $.referabilityImports(srcModule, entry, destModule);
      let rnmap = [];

      if (eimp) {
         importsToRemove.push(eimp);
         if ($.importedAs(eimp) !== entry) {
            rnmap.push([$.importedAs(eimp), entry]);
         }
         importSectionAffected.add(destModule);
      }

      if (simp) {
         rnmap.push([$.joindot(simp.alias, entry), entry]);
      }

      defnRenames.push({
         module: destModule,
         rnmap
      });
   }

   // Examine srcModule
   if ($.isReferredTo(srcModule, entry, entry)) {
      let simp = $.starImportFromTo(destModule, srcModule);

      if (simp) {
         defnRenames.push({
            module: srcModule,
            rnmap: [entry, $.joindot(simp.alias, entry)]
         });
      }
      else {
         importsToAdd.push({
            recp: srcModule,
            donor: destModule,
            name: entry,
            alias: null
         });
         importSectionAffected.add(srcModule);
      }
   }

   return {
      blockingReferrers,
      defnRenames,
      importsToAdd,
      importsToRemove,
      importSectionAffected
   };
}
