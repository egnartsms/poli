common
   check
   compare
   compareArrays
   concat
   dumpImportSection
   hasOwnProperty
   indexOf
   joindot
   map
   patchNullableObj
   patchObj
code-modify
   globalCodeModifications
exc
   ApiError
   genericError
trie
   * as: trie
vector
   * as: vec
world
   delta
   groups
   commit
   rollback
   patchBox
   setBox
-----
delmark ::= Object.create(null)
main ::= function (sendMessage) {
   return msg => $.handleMessage(msg, sendMessage);
}
pendingCodeModifications ::= false
commitPendingCodeModifications ::= function (msg) {
   $.check($.pendingCodeModifications);

   if (msg['type'] !== 'modify-code-result') {
      throw new Error(`Expected 'modify-code-result' message, got: ${msg['type']}`);
   }

   if (msg['success']) {
      for (let {v: mval} of $.delta['module'].changed) {
         if (mval.nsDelta !== null) {
            for (let [key, val] of Object.entries(mval.nsDelta)) {
               if (val === $.delmark) {
                  delete mval.ns[key];
               }
               else {
                  mval.ns[key] = val;
               }
            }
            
            mval.nsDelta = null;
         }
      }

      $.commit();
   }
   else {
      $.rollback();
   }

   $.pendingCodeModifications = false;
}
handleMessage ::= function (msg, sendMessage) {
   if ($.pendingCodeModifications) {
      $.commitPendingCodeModifications(msg);
      return;
   }

   let stopwatch = (() => {
      let start = new Date;
      return () => {
         let elapsed = new Date - start;
         return `${elapsed} ms`;
      };
   })();

   try {      
      let result = $.operationHandlers[msg['op']](msg['args']);
      let codeModifications = $.globalCodeModifications();

      if (codeModifications.length > 0) {
         console.log("Code modifications:", codeModifications);
         $.pendingCodeModifications = true;
      }

      sendMessage({
         type: 'api-call-result',
         success: true,
         result: result === undefined ? null : result,
         modifyCode: codeModifications
      });

      console.log(msg['op'], `SUCCESS`, `(${stopwatch()})`);
   }
   catch (e) {
      let error, message, info;
      
      if (e instanceof $.ApiError) {
         error = e.error;
         message = e.message;
         info = e.info;
      }
      else {
         error = 'uncaught';
         message = e.message;
         info = {};
      }

      sendMessage({
         type: 'api-call-result',
         success: false,
         error: error,
         message: message,
         info: info,
      });

      console.error(e);
      console.log(msg['op'], `FAILURE`, `(${stopwatch()})`);
   }
}
moduleByName ::= function (name) {
   return $.trie.at($.groups['module.name'].v, name, () => {
      throw $.genericError(`Unknown module name: '${name}'`);
   });
}
entryByName ::= function (module, name) {
   return $.trie.at(module.entries.v, name, () => {
      throw $.genericError(`Module '${module.v.name}': not found entry '${name}'`);
   });
}
moduleEval ::= function (ns, code) {
   let fun = Function('$', `"use strict";\n   return (${code})`);
   return fun.call(null, ns);
}
isStarEntry ::= function (entry) {
   return entry.v.name === null;
}
isStarImport ::= function (imp) {
   return $.isStarEntry(imp.entry);
}
operationHandlers ::= ({
   getEntries: function () {
      let res = [];
      
      for (let module of $.trie.ivalues($.groups['module.name'].v)) {
         for (let entry of module.v.members) {
            res.push([module.v.name, entry.v.name]);
         }
      }
      
      return res;
   },
   
   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      
      return Array.from($.moduleNames(module));
   },

   getNameAt: function ({module: moduleName, at}) {
      let module = $.moduleByName(moduleName);

      return $.vec.at(module.v.members, at).v.name;
   },
   
   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, name);

      return entry.v.strDef;
   },
   
   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);
      
      let targetModule;

      if (star === null) {
         targetModule = module;
      }
      else {
         let simp = $.trie.atOr(module.imports.v, star);

         if (!$.isStarImport(simp)) {
            return [];
         }

         targetModule = simp.entry.v.module;
      }

      let res = [];

      for (let name of $.moduleNames(targetModule)) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      return res;
   },
   
   getImportables: function ({recp: recpName}) {
      let module = $.moduleByName(recpName);

      return $.importablesInto(module);
   },

   findReferences: function ({module: moduleName, star, name}) {
      let module = $.moduleByName(moduleName);
      let entry = $.resolveReference(module, [star, name]);
      
      if (entry === null || $.isStarEntry(entry)) {
         return null;
      }
      
      let res = [[entry.v.module.v.name, entry.v.name]];
      
      for (let imp of $.trie.ivalues(entry.imports.v)) {
         res.push([imp.recp.v.name, imp.as]);
      }
      
      for (let imp of $.trie.ivalues(entry.v.module.starEntry.imports.v)) {
         res.push([imp.recp.v.name, $.joindot(imp.alias, entry.v.name)]);
      }
      
      res.sort($.compareArrays);
      
      return res;
   },
   
   editEntry: function ({module: moduleName, name, newDef}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, name);
      
      $.setEntryDef(entry, newDef.trim());
   },
   
   renameEntry: function ({module: moduleName, index, newName}) {
      let module = $.moduleByName(moduleName);
      let entry = $.vec.at(module.v.members, index);

      if ($.isNameBound(module, newName)) {
         throw $.genericError(
            `Module '${module.v.name}': name '${newName}' already defined or imported`
         );
      }
      
      let offendingModules = $.offendingModulesOnRename(entry, newName);
      if (offendingModules.length > 0) {
         throw $.genericError(
            `Cannot rename to "${newName}": name conflict in modules: ` +
            `${offendingModules.map(m => m.v.name).join(',')}`
         );
      }

      $.changeReferrersForRename(module.id, oldName, newName);
      $.changeImportsForRename(module.id, oldName, newName);
      $.rel.alterFactByPk($.G.modules, module.id, module => $.patchModule(module, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: module.ns[oldName]
         },
         members: $.vec.update(module.members, $.vec.setAt, index, newName),
         entries: $.rel.update(
            module.entries, $.rel.patchFactByPk, oldName, {name: newName}
         ),
      }));
   },

   addEntry: function ({module: moduleName, name, def, index}) {
      let module = $.moduleByName(moduleName);

      if ($.isNameBound(name, module)) {
         throw $.genericError(
            `Module '${module.name}': name '${name}' already defined or imported`
         );
      }

      def = def.trim();
      let val = $.moduleEval(module.ns, def);

      $.rel.alterFact($.G.modules, module, $.patchModule, {
         nsDelta: {
            [name]: val
         },
         entries: $.rel.update(module.entries, $.rel.addFact, {
            name: name,
            strDef: def,
            def: def
         }),
         members: $.vec.update(module.members, $.vec.insertAt, index, name)
      });
   },
   
   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);
      $.entryByName(module, name);
      
      if (direction !== 'up' && direction !== 'down') {
         throw $.genericError(`Invalid direction name: '${direction}'`);
      }

      let i = $.indexOf(module.members, name);
      let j = direction === 'up' ?
               (i === 0 ? $.vec.size(module.members) - 1 : i - 1) :
               (i === $.vec.size(module.members) - 1 ? 0 : i + 1);

      $.rel.alterFact($.G.modules, module, $.patchModule, {
         members: $.vec.update(module.members, members => {
            $.vec.deleteAt(members, i);
            $.vec.insertAt(members, j, name);
         })
      })
   },
   
   import: function ({recp: recpName, donor: donorName, name, alias}) {
      let recp = $.moduleByName(recpName);
      let donor = $.moduleByName(donorName);

      if (name !== '') {
         if (!$.trie.hasAt(donor.entries.byName, name)) {
            throw $.genericError(
               `Module '${recp.name}': cannot import '${entry}' from ` +
               `'${donor.name}': no such definition`
            );
         }
      }
      else if (alias === null) {
         throw $.genericError(
            `Cannot star import '${donor.name}' into '${recp.name}' without alias`
         );
      }
      
      let imp = $.impobj({
         recpid: recp.id,
         donorid: donor.id,
         entry: name,
         alias: alias
      });
      
      if ($.isNameBound(imp.importedAs, recp)) {
         throw $.genericError(
            `Module '${recp.name}': cannot import '${$.importSpec(imp)}' from ` +
            `'${donor.name}': collides with another name`
         );
      }
      
      $.rel.addFact($.G.imports, imp);
      $.rel.alterFact($.G.modules, recp, $.patchModule, {
         nsDelta: {
            [imp.importedAs]: name === '' ? donor.ns : donor.ns[name]
         }
      });
   },
   
   move: function ({
      src: srcModuleName,
      entry: entryName,
      dest: destModuleName,
      index: index
   }) {
      return 0;
   },
})
importSpec ::= function ({entry, alias}) {
   if (entry === null) {
      return `* as: ${alias}`;
   }
   else if (alias === null) {
      return entry;
   }
   else {
      return `${entry} as: ${alias}`
   }
}
resolveName ::= function (module, name) {
   let entry = $.trie.atOr(module.entries.v, name);
   if (entry !== undefined) {
      return entry;
   }

   let imp = $.trie.atOr(module.imports.v, name);
   if (imp !== undefined) {
      return imp.entry;
   }
   
   return null;
}
resolveReference ::= function (module, ref) {
   let [star, name] = ref;
   
   if (star === null) {
      return $.resolveName(module, name);
   }
   
   let entry = $.resolveName(module, star);

   if (entry === null) {
      return null;
   }
     
   if ($.isStarEntry(entry)) {
      return $.trie.atOr(entry.v.module.entries.v, name);
   }
   
   // this is '$$.member.field', so star is not really a star reference but an entry
   // reference. We then must fix 'ref' in-place
   ref[0] = null;
   ref[1] = star;

   return entry;
}
importablesInto ::= function (module) {
   function encodeEntry(entry) {
      return JSON.stringify([entry.v.module.v.name, entry.v.name]);
   }

   let importables = new Set;

   for (let xmod of $.trie.ivalues($.groups['module.name'])) {
      if (xmod === module) {
         continue;
      }

      for (let e of $.trie.ivalues(xmod.entries)) {
         importables.add(encodeEntry(e));
      }
      importables.add(encodeEntry(xmod.starEntry));
   }

   // Exclude those already imported
   for (let {entry} of $.trie.ivalues(module.imports)) {
      importables.delete(encodeEntry(entry));
   }

   return Array.from(importables, JSON.parse);
}
importsOf ::= function (mid, entryName) {
   return Array.from($.trie.values($.rel.groupAt($.G.imports.from, mid, entryName)));
}
importsInto ::= function (mid) {
   return Array.from($.trie.values($.rel.groupAt($.G.imports.into, mid)));
}
referringsTo ::= function (mid, entryName) {
   let emap = $.rel.groupAt($.G.imports.from, mid, entryName);
   let smap = $.rel.groupAt($.G.imports.from, mid, '');
   
   let recpids = new Set($.concat($.trie.keys(emap), $.trie.keys(smap)));
   
   return Array.from(recpids, recpid => ({
      eimp: $.trie.tryAt(emap, recpid),
      simp: $.trie.tryAt(smap, recpid),
      recpid
   }));
}
setEntryDef ::= function (entry, newDef) {
   let newVal = $.moduleEval(entry.v.module.v.ns, newDef);
   
   $.patchBox(entry, {
      strDef: newDef,
      def: newDef
   });
   $.updateBox(entry.v.module, $.patchModule, {
      nsDelta: {
         [entry.v.name]: newVal
      }
   });
  
   // Propagate newVal to recipients
   for (let imp of $.trie.ivalues(entry.imports.v)) {
      $.updateBox(imp.recp, $.patchModule, {
         nsDelta: {
            [imp.as]: newVal
         }
      });
   }
}
offendingModulesOnRename ::= function (entry, newName) {
   let offendingModules = [];
   
   for (let {alias, recp} of $.trie.ivalues(entry.imports.v)) {
      if (alias === null) {
         if ($.isNameBound(recp, newName)) {
            offendingModules.push(recp);
         }
      }
   }

   return offendingModules;
}
changeImportsForRename ::= function (mid, oldName, newName) {
   let eimps = $.importsOf(mid, oldName);
   
   for (let imp of eimps) {
      if (imp.alias !== null) {
         continue;
      }
      
      $.rel.alterFactByPk($.G.modules, imp.recpid, recp => $.patchModule(recp, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: recp.ns[oldName]
         }
      }));
   }
   
   $.rel.alterFacts($.G.imports, eimps, $.patchObj, {entry: newName});
}
changeReferrersForRename ::= function (mid, oldName, newName) {
   for (let {eimp, simp, recpid} of $.referringsTo(mid, oldName)) {
      let renames = [];
      
      if (eimp !== undefined && eimp.alias === null) {
         renames.push([oldName, newName]);
      }
      
      if (simp !== undefined) {
         renames.push([[simp.alias, oldName], [simp.alias, newName]]);
      }
      
      $.renameRefs(recpid, renames);
   }
   
   $.renameRefs(mid, [[oldName, newName]]);
}
doimport ::= function (imp) {
   $.rel.addFact($.G.imports, imp);
   
   let donor = $.trie.at($.G.modules.byId, imp.donorid);
   let recp = $.trie.at($.G.modules.byId, imp.recpid);

   $.rel.alterFact($.G.modules, recp, $.patchModule, {
      nsDelta: {
         [imp.importedAs]: imp.entry === '' ? donor.ns : donor.ns[imp.entry]
      }
   });
}
unimport ::= function (imp) {
   $.rel.removeFact($.G.imports, imp);
   
   $.rel.alterFactByPk($.G.modules, imp.recpid, $.patchModule, {
      nsDelta: {
         [imp.importedAs]: $.delmark
      }
   });
}
splitRef ::= function (sref) {
   let pref = sref.split('.');

   if (pref.length === 1) {
      pref.unshift(null);
   }
   
   return pref;
}
joinRef ::= function (ref, wth='.') {
   if (ref[0] === null)
      return ref[1];
   else
      return ref[0] + wth + ref[1];
}
renameRefs ::= function (mid, renames) {
   if (renames.length === 0) {
      return;
   }
   
   let alts = [];
   let map = new Map;
   
   function normalizeRef(ref) {
      return (typeof ref === 'string') ? [null, ref] : ref;
   }
   
   for (let [oref, nref] of renames) {
      oref = normalizeRef(oref);
      nref = normalizeRef(nref);
      
      alts.push($.joinRef(oref, '\\.'));
      map.set($.joinRef(oref), $.joinRef(nref));
   }
   
   let re = new RegExp(`(?<![\\w$])(?<=\\$\\.)${alts.join('|')}\\b`, 'g');
   
   for (let entry of $.trie.at($.G.modules.byId, mid).entries) {
      let newDef = entry.def.replace(re, map.get.bind(map));
      
      if (newDef !== entry.def) {
         $.setEntryDef(mid, entry.name, newDef);
      }
   }
}
extractRefs ::= function (strDef) {
   let re = /(?<![\w$])(?<=\$\.)(\w+(?:\.\w+)?)\b/g;
   let srefs = new Set(strDef.match(re));
   
   return Array.from(srefs, $.splitRef);
}
hasModuleRef ::= function (mid, ref, exceptEntry=null) {
   let re = new RegExp(`(?<![\\w$])(?<=\\$\\.)${$.joinRef(ref, '\\.')}\\b`);

   for (let {name, def} of $.trie.at($.G.modules.byId, mid).entries) {
      if (name !== exceptEntry && re.test(def)) {
         return true;
      }
   }
   
   return false;
}
computeForwardModificationsOnMoveEntry ::= function (srcmid, entryName, dstmid) {
   let danglingRefs = [];
   let offendingRefs = [];
   let renames = [];
   let importsToAdd = [];
   
   let {def: entryDef} = 
      $.trie.at($.trie.at($.G.modules.byId, srcmid).entries.byName, entryName);

   for (let ref of $.extractRefs(entryDef)) {
      let {mid: oMid, entry: oEntryName} = $.resolveReference(srcmid, ref);

      if (oMid === undefined) {
         danglingRefs.push(ref);
         continue;
      }

      if (oMid === dstmid) {
         // The reference "comes home"
         renames.push([ref, oEntryName]);
         continue;
      }

      // See whether the entry is already imported directly from oMid into dstmid
      let eimp = $.trie.tryAt($.G.imports.from, oMid, oEntryName, dstmid);
      if (eimp !== undefined) {
         renames.push([ref, eimp.importedAs]);
         continue;
      }
      
      // If not imported directly then the oMid may have already been star-imported
      let simp = $.trie.tryAt($.G.imports.from, oMid, '', dstmid);
      if (simp !== undefined) {
         renames.push([ref, [simp.alias, oEntryName]]);
         continue;
      }

      // Must import it directly then
      if ($.isNameFree($.trie.at($.G.modules.byId, dstmid), ref[1])) {
         importsToAdd.push(
            $.impobj({
               donorid: oMid,
               recpid: dstmid,
               entry: oEntryName,
               alias: ref[1] === oEntryName ? null : ref[1]
            })
         );
         continue;
      }
      
      // If all else fails, we cannot do anything about this ref
      offendingRefs.push(ref);
   }

   return {
      offendingRefs,
      danglingRefs,
      renames,
      importsToAdd
   };
}
computeBackwardModificationsOnMoveEntry ::= function (srcmid, entryName, dstmid) {
   let blockingReferrers = [];
   let moduleRenames = [];
   let importsToAdd = [];
   let importsToRemove = [];

   for (let {recpid, eimp, simp} of $.referringsTo(srcmid, entryName)) {
      if (recpid === dstmid) {
         // Dest module was importing from src module
         let renames = [];

         if (eimp !== undefined) {
            importsToRemove.push(eimp);
            if (eimp.importedAs !== entryName) {
               renames.push([eimp.importedAs, entryName]);
            }
         }

         if (simp !== undefined) {
            renames.push([[simp.alias, entryName], entryName]);
         }

         moduleRenames.push({
            mid: dstmid,
            renames: renames
         });

         continue;
      }
      
      if (eimp !== undefined) {
         importsToRemove.push(eimp);
         importsToAdd.push($.impobj({...eimp, donorid: dstmid}));
      }

      if (simp !== undefined && $.hasModuleRef(recpid, [simp.alias, entryName])) {
         let simpd = $.trie.tryAt($.G.imports.from, dstmid, '', recpid);
         
         if (simpd !== undefined) {
            moduleRenames.push({
               mid: recpid,
               rename: [[simp.alias, entryName], [simpd.alias, entryName]]
            });
         }
         else if (eimp) {
            moduleRenames.push({
               mid: recpid,
               rename: [[simp.alias, entryName], [null, eimp.importedAs]]
            });
         }
         else {
            blockingReferrers.push(recpid);
         }
      }
   }

   // Examine srcmid itself 
   if ($.hasModuleRef(srcmid, [null, entryName], entryName)) {
      let simp = $.trie.tryAt($.G.imports.from, dstmid, '', srcmid);

      if (simp !== undefined) {
         moduleRenames.push({
            mid: srcmid,
            rename: [[null, entryName], [simp.alias, entryName]]
         });
      }
      else {
         importsToAdd.push(
            $.impobj({
               donorid: dstmid,
               recpid: srcmid,
               entry: entryName,
               alias: null
            })
         );
      }
   }

   return {
      blockingReferrers,
      moduleRenames,
      importsToAdd,
      importsToRemove,
   };
}
removeEntryFromModule ::= function (module, entryName) {
   return $.patchModule(module, {
      nsDelta: {
         [entryName]: $.delmark
      },
      entries: $.rel.update(module.entries, $.rel.removeFactByPk, entryName),
      members: $.vec.update(module.members, $.vec.remove, entryName)
   });
}
moveEntry ::= function (srcmid, entryName, dstmid, index) {
   if (srcmid === dstmid) {
      throw $.genericError(`Cannot move inside a single module`);
   }

   let src = $.trie.at($.G.modules.byId, srcmid);
   let dst = $.trie.at($.G.modules.byId, dstmid);

   $.entryByName(src, entryName);
   
   if (!$.isNameFree(entryName, dst)) {
      // There may actually be an import of entry from src into dst, in which case it
      // must be possible to move the entry (just delete the import)
      let imp = $.trie.tryAt($.G.imports.from, srcmid, entryName, dstmid);
      if (!(imp !== undefined && imp.importedAs === entryName)) {
         throw $.genericError(
            `Module '${dst.name}': name '${entryName}' already imported or defined`
         );
      }
   }

   let fwd = $.computeForwardModificationsOnMoveEntry(srcmid, entry, dstmid);
   let bwd = $.computeBackwardModificationsOnMoveEntry(srcmid, entry, dstmid);

   if (fwd.offendingRefs.length > 0 || bwd.blockingReferrers.length > 0) {
      return {
         moved: false,
         offendingRefs: Array.from(fwd.offendingRefs, ref => $.joinRef(ref)),
         blockingReferrers: Array.from(
            bwd.blockingReferrers,
            mid => $.trie.at($.G.modules.byId, mid).name
         )
      };
   }

   // Now, effectuate the changes. Our primary concern here is that $.renameRefs
   // processes all the entries of a module, but we must avoid processing the entry
   // that's being moved itself 'cause it has its own rename map. So we must first
   // delete 'entryName' from 'srcmid'.
   $.rel.alterFactByPk($.G.modules, srcmid, $.removeEntryFromModule, entryName);
   
   return;
   $.rel.removeFacts($.G.imports, bwd.importsToRemove);

   
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

      newCode = oldCode.replace(re, ref => fwd.renameMap.get(ref));
   }
   else {
      newCode = oldCode;
   }

   let newVal = $.moduleEval(destModule, newCode);

   destModule.defs[entry] = newCode;
   $.rtset(destModule, entry, newVal);

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

   // Stage 5. Add imports
   for (let imp of [...fwd.importsToAdd, ...bwd.importsToAdd]) {
      $.import(imp);
   }

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
moduleNames ::= function* (module) {
   yield* $.trie.ikeys(module.entries.v);
   yield* $.trie.ikeys(module.imports.v);
}
isNameBound ::= function (module, name) {
   return (
      $.trie.hasAt(module.entries.v, name) ||
      $.trie.hasAt(module.imports.v, name)
   );
}
isNameFree ::= function (module, name) {
   return !$.isNameBound(module, name);
}
patchModule ::= function (module, patch) {
   let nsDelta = patch.nsDelta == null ? 
      module.nsDelta :
      Object.assign(module.nsDelta || {}, patch.nsDelta)

   return {
      ...module,
      ...patch,
      nsDelta
   };
}
serialize ::= function (obj) {
   const inds = '   ';

   function* serializeObject(object) {
      let entries = Object.entries(object);

      if (entries.length === 0) {
         yield '{}';
         return;
      }

      yield '({\n';
      for (let [key, val] of entries) {
         yield inds.repeat(1);
         yield key;
         yield ': ';
         yield* serialize(val, false);
         yield ',\n';
      }
      yield inds.repeat(0);
      yield '})';
   }

   function* serializeArray(array) {
      if (array.length === 0) {
         yield '[]';
         return;
      }

      yield '[\n';
      for (let obj of array) {
         yield inds.repeat(1);
         yield* serialize(obj, false);
         yield ',\n'
      }
      yield inds.repeat(0);
      yield ']';
   }

   function* serialize(obj, expand) {
      if (typeof obj === 'object') {
         if (obj === null) {
            yield String(obj);
         }
         else if (obj instanceof Array) {
            if (expand) {
               yield* serializeArray(obj);
            }
            else {
               yield '[...]';
            }
         }
         else {
            if (expand) {
               yield* serializeObject(obj);
            }
            else {
               yield '{...}';
            }
         }
      }
      else if (typeof obj === 'function') {
         if (expand) {
            yield obj.toString();
         }
         else {
            yield 'func {...}'
         }
      }
      else if (typeof obj === 'string') {
         yield JSON.stringify(obj);
      }
      else {
         yield String(obj);
      }
   }

   return Array.from(serialize(obj, true)).join('');
}
