bootstrap
   hasOwnProperty
   imports
   makeModule
   moduleEval
   modules
   saveObject
img2fs
   flushModule
   genModuleImportSection
import
   deleteImport
   importFor
   importFromTo
   importedAs
   importsOf
   isNameUsedForImport
   recipientsOf
   referabilityImports
   starImportFromTo
persist
   deleteArrayItem
   deleteObject
   deleteObjectProp
   setObjectProp
reference
   anyDefRefersTo
   extractRefs
   isNameFree
   isNameReferredTo
   referrerModules
   whereNameCame
rt-rec
   applyRtDelta
   delmark
   discardRtDelta
   rtget
   rtset
-----
assert ::= $_.require('assert').strict
WebSocket ::= $_.require('ws')
port ::= 8080
server ::= null
ws ::= null
main ::= function () {
   $.server = new $.WebSocket.Server({port: $.port});
   $.server
      .on('error', function (error) {
         console.error("WebSocket server error:", error);
      })
      .on('connection', function (ws) {
         if ($.ws !== null) {
            console.error("Double simultaneous connections attempted");
            ws.close();
            return;
         }

         $.ws = ws;
         $.ws
            .on('message', function (data) {
               $.handleOperation(JSON.parse(data));
            })
            .on('close', function (code, reason) {
               $.ws = null;
               console.log("Front-end disconnected. Code:", code, "reason:", reason);
            })
            .on('error', function (error) {
               console.error("WebSocket client connection error:", error);
            });

         console.log("Front-end connected");
      });
}
handleOperation ::= function (op) {
   let stopwatch = (() => {
      let start = process.hrtime();
      return () => {
         let [sec, nano] = process.hrtime(start);
         return `${sec}.${String(Math.round(nano / 1e6)).padStart(3, '0')}`;
      };
   })();

   try {      
      $_.db.transaction(() => $.opHandlers[op['op']].call(null, op['args']))();
      $.applyRtDelta();
      console.log(op['op'], `SUCCESS`, `(${stopwatch()})`);
   }
   catch (e) {
      // Remember that we don't yet have a normal rolling back, so after a failure
      // things in memory will most likely be corrupted.
      $.discardRtDelta();
      console.error(e);
      $.opExc('generic', {stack: e.stack, message: e.message});
      console.log(op['op'], `FAILURE`, `(${stopwatch()})`);
   }
}
send ::= function (msg) {
   $.ws.send(JSON.stringify(msg));
}
opExc ::= function (error, info) {
   $.send({
      success: false,
      error: error,
      info: info
   });
}
opRet ::= function (result=null) {
   $.send({
      success: true,
      result: result
   });
}
opHandlers ::= ({
   getModules: function () {
      $.opRet(Object.keys($.modules));
   },

   getEntries: function () {
      let res = [];

      for (let module of Object.values($.modules)) {
         for (let entry of module.entries) {
            res.push([module.name, entry]);
         }
      }

      $.opRet(res);
   },

   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      
      if (!$.hasOwnProperty(module.defs, name)) {
         throw new Error(`Member "${name}" not found in module "${moduleName}"`);
      }

      $.opRet(module.defs[name].src);
   },

   getModuleEntries: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.opRet(module.entries);
   },

   add: function ({module: moduleName, name, defn, anchor, before}) {
      let module = $.moduleByName(moduleName);

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
         type: 'native',
         src: defn
      });

      $.opRet();
   },

   edit: function ({module: moduleName, name, newDefn}) {
      let module = $.moduleByName(moduleName);

      if (!$.hasOwnProperty(module.defs, name)) {
         throw new Error(`Not found entry "${name}" in module "${moduleName}"`);
      }

      let newVal = $.moduleEval(module, newDefn);

      $.deleteObject(module.defs[name]);
      $.setObjectProp(module.defs, name, {
         type: 'native',
         src: newDefn
      });

      $.rtset(module, name, newVal);
      $.propagateValueToRecipients(module, name, newVal);

      $.opRet();
   },

   rename: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);

      if (!$.hasOwnProperty(module.defs, oldName)) {
         throw new Error(`Did not find an entry named "${oldName}"`);
      }
      if (oldName === newName) {
         $.opRet([]);
         return;
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

      $.setObjectProp(module.entries, module.entries.indexOf(oldName), newName);
      $.setObjectProp(module.defs, newName, module.defs[oldName]);
      $.deleteObjectProp(module.defs, oldName);

      $.rtset(module, newName, $.rtget(module, oldName));
      $.rtset(module, oldName, $.delmark);

      let res = [];

      for (let {module, modifiedEntries, importSectionAffected} of modifiedModules) {
         res.push({
            module: module.name,
            modifiedEntries,
            importSection: importSectionAffected ? $.dumpImportSection(module) : null
         });
      }

      $.opRet(res);
   },

   delete: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let deleted = $.deleteEntry(module, name, false);
      $.opRet(deleted);
   },

   deleteCascade: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);

      let recipients = $.recipientsOf(module, name);
      $.deleteEntry(module, name, true);
      $.opRet($.dumpImportSections(recipients));
   },

   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);

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

      $.opRet();
   },

   move: function ({
      srcModule: srcModuleName,
      entry,
      destModule: destModuleName,
      anchor,
      before
   }) {
      let srcModule = $.moduleByName(srcModuleName);
      let destModule = $.moduleByName(destModuleName);

      $.opRet($.moveEntry(srcModule, entry, destModule, anchor, before));
   },

   getImportables: function ({recp: recpModuleName}) {
      function encodeEntry(moduleName, entry) {
         return JSON.stringify([moduleName, entry]);
      }

      function decodeEntry(encoded) {
         return JSON.parse(encoded);
      }

      let recp = $.moduleByName(recpModuleName);
      
      let importables = new Set;

      for (let moduleName in $.modules) {
         let module = $.modules[moduleName];
         if (module === recp) {
            continue;
         }

         for (let e of module.entries) {
            importables.add(encodeEntry(module.name, e));
         }
         importables.add(encodeEntry(module.name, null));
      }

      // Exclude those already imported
      for (let imp of $.imports) {
         if (imp.recp === recp) {
            importables.delete(encodeEntry(imp.donor.name, imp.name));
         }
      }

      $.opRet(Array.from(importables, decodeEntry));
   },

   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.opRet([...module.entries, ...module.importedNames]);
   },

   import: function ({recp: recpModuleName, donor: donorModuleName, name, alias}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);

      $.effectuateImport({recp, donor, name: name || null, alias: alias || null});

      $.saveObject(recp.importedNames);
      $.saveObject($.imports);

      $.opRet($.dumpImportSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      let unused = [];

      for (let imp of $.imports) {
         if (imp.recp === module && !$.isNameReferredTo(module, $.importedAs(imp))) {
            unused.push(imp);
         }
      }

      for (let imp of unused) {
         $.deleteImport(imp);
      }

      if (unused.length > 0) {
         $.saveObject(module.importedNames);
         $.saveObject($.imports);
      }

      $.opRet({
         importSection: unused.length > 0 ? $.dumpImportSection(module) : null,
         removedCount: unused.length
      });
   },

   removeUnusedImportsInAllModules: function () {
      let unused = [];
      let recps = new Set;

      for (let imp of $.imports) {
         if (!$.isNameReferredTo(imp.recp, $.importedAs(imp))) {
            unused.push(imp);
            recps.add(imp.recp);
         }
      }

      for (let imp of unused) {
         $.deleteImport(imp);
      }

      if (unused.length > 0) {
         for (let recp of recps) {
            $.saveObject(recp.importedNames);
         }
         $.saveObject($.imports);
      }

      $.opRet({
         removedCount: unused.length,
         modifiedModules: Array.from(recps, module => ({
            module: module.name,
            importSection: $.dumpImportSection(module),
            modifiedEntries: []
         }))
      });
   },

   renameImport: function ({module: moduleName, importedAs, newAlias}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }
      let modifiedEntries = $.renameImport(imp, newAlias);
      $.opRet({
         modifiedEntries: modifiedEntries || [],
         importSection: modifiedEntries === null ? null : $.dumpImportSection(module)
      });
   },

   deleteImport: function ({module: moduleName, importedAs, force}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }

      let isUsed = $.isNameReferredTo(module, importedAs);

      if (isUsed && !force) {
         $.opRet({
            deleted: false
         });
         return;
      }

      $.deleteImport(imp);
      $.saveObject(module.importedNames);
      $.saveObject($.imports);

      $.opRet({
         deleted: true,
         importSection: $.dumpImportSection(module)
      });
   },

   eval: function ({module: moduleName, code}) {
      let module = $.moduleByName(moduleName);

      let res;

      try {
         res = $.moduleEval(module, code);
      }
      catch (e) {
         $.opExc('replEval', {stack: e.stack, message: e.message});
         return;
      }

      $.opRet($.serialize(res));
   },

   getCompletions: function ({module: moduleName, prefix}) {
      let module = $.moduleByName(moduleName);

      let res = [];

      for (let name of [...module.entries, ...module.importedNames]) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      $.opRet(res);
   },

   addModule: function ({module: moduleName}) {
      if ($.hasOwnProperty($.modules, moduleName)) {
         throw new Error(`Module with the name "${moduleName}" already exists`);
      }

      $.setObjectProp($.modules, moduleName, $.makeModule(moduleName, []));

      $.opRet();
   },

   renameModule: function ({module: moduleName, newName}) {
      let module = $.moduleByName(moduleName);

      if ($.hasOwnProperty($.modules, newName)) {
         throw new Error(`Module with the name "${moduleName}" already exists`);
      }

      $.setObjectProp($.modules, newName, module);
      $.deleteObjectProp($.modules, moduleName);
      $.setObjectProp(module, 'name', newName);

      let affected = new Set;
      for (let imp of $.imports) {
         if (imp.donor === module) {
            affected.add(imp.recp);
         }
      }

      $.opRet($.dumpImportSections(affected));
   },

   refreshModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.flushModule(module);

      $.opRet();
   },

   findReferences: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let {module: originModule, name: originName} = $.whereNameCame(module, name);
      
      if (originModule == null) {
         throw new Error(`Module "${module.name}": not known name "${name}"`);
      }

      let res = {
         [originModule.name]: originName
      };

      for (let imp of $.importsOf(originModule, originName)) {
         res[imp.recp.name] = $.importedAs(imp);
      }

      $.opRet(res);
   },

   replaceUsages: function ({module: moduleName, name, newName}) {
      let module = $.moduleByName(moduleName);

      if ($.isNameFree(module, name)) {
         throw new Error(`Unknown name "${name}" in module ${module.name}`);
      }
      if ($.isNameFree(module, newName)) {
         throw new Error(`Unknown name "${newName}" in module ${module.name}`);
      }

      let modifiedEntries = $.renameRefsIn(module, [name, newName]);
      return $.opRet({
         importSection: null,
         modifiedEntries
      });
   }

})
moduleByName ::= function (name) {
   let module = $.modules[name];
   if (!module) {
      throw new Error(`Unknown module name: ${name}`);
   }
   return module;
}
effectuateImport ::= function (imp) {
   $.assert(!$.imports.has(imp));

   if (imp.name === null) {
      imp.recp.importedNames.add(imp.alias);
      $.rtset(imp.recp, imp.alias, imp.donor.rtobj);
   }
   else {
      imp.recp.importedNames.add($.importedAs(imp));
      $.rtset(imp.recp, $.importedAs(imp), $.rtget(imp.donor, imp.name));
   }

   $.imports.add(imp);
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
dumpImportSection ::= function (module) {
   let pieces = [];
   for (let piece of $.genModuleImportSection(module)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
dumpImportSections ::= function (modules) {
   let result = {};
   for (let module of modules) {
      result[module.name] = $.dumpImportSection(module);
   }
   return result;
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
renameImport ::= function (imp, newAlias) {
   let recp = imp.recp;
   let oldName = $.importedAs(imp);
   let newName = newAlias || imp.name;

   if (newName === oldName) {
      return null;
   }
   if (imp.name === null && !newAlias) {
      throw new Error(`Module import ("${imp.donor.name}") is left unnamed`);
   }
   if (!$.isNameFree(recp, newName)) {
      throw new Error(`Cannot rename import to "${newName}": name already occupied`);
   }

   $.renameImportedName(recp, oldName, newName);
   $.setObjectProp(imp, 'alias', newAlias || null);
   return $.renameRefsIn(recp, [oldName, newName]);
}
renameImportedName ::= function (recp, oldName, newName) {
   $.rtset(recp, newName, $.rtget(recp, oldName));
   $.rtset(recp, oldName, $.delmark);

   recp.importedNames.delete(oldName);
   recp.importedNames.add(newName);
   $.saveObject(recp.importedNames);
}
renameRefsIn ::= function (module, renameMap) {
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

   let re = new RegExp(`(?<=\\$\\.)${alts.join('|')}\\b`, 'g');
   let modifiedEntries = [];

   for (let entry of module.entries) {
      let oldCode = module.defs[entry].src;
      let newCode = oldCode.replace(re, ref => renameMap.get(ref));
      
      if (oldCode === newCode) {
         continue;
      }

      let newVal = $.moduleEval(module, newCode);

      $.deleteObject(module.defs[entry]);
      $.setObjectProp(module.defs, entry, {
         type: 'native',
         src: newCode
      });

      $.rtset(module, entry, newVal);
      $.propagateValueToRecipients(module, entry, newVal);

      modifiedEntries.push([entry, newCode]);
   }

   return modifiedEntries;
}
propagateValueToRecipients ::= function (module, name, val) {
   for (let imp of $.importsOf(module, name)) {
      $.rtset(imp.recp, $.importedAs(imp), val);
   }
}
joindot ::= function (starName, entryName) {
   return starName + '.' + entryName;
}
updateImportForEntryRename ::= function (imp, newName) {
   if (imp.alias === null) {
      $.renameImportedName(imp.recp, imp.name, newName);
   }
   $.setObjectProp(imp, 'name', newName);
}
modifyRecipientsForRename ::= function (module, oldName, newName) {
   let referrers = $.referrerModules(module, oldName);
   let modifiedModules = [];

   for (let referrer of referrers) {
      let rnmap = new Map;
      let {eimp, simp} = $.referabilityImports(module, oldName, referrer);

      if (eimp) {
         $.updateImportForEntryRename(eimp, newName);
         if (eimp.alias === null) {
            rnmap.set(oldName, newName);
         }
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
      $.effectuateImport(imp);
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

   function originOf(ref) {
      let pref = ref.split('.');
      let refModule, refName;

      if (pref.length === 1) {
         refModule = null;
         [refName] = pref;
      }
      else {
         [refModule, refName] = pref;
      }

      if (refModule !== null) {
         let {module, name} = $.whereNameCame(srcModule, refModule);
         if (module == null) {
            return {
               found: false
            };
         }
         if (name !== null) {
            // ref is 'D.importedEntry.property'
            return {
               found: true,
               module,
               name,
               ref: refModule,
               refName: refModule
            }
         }
         if (!$.hasOwnProperty(module.defs, refName)) {
            return {
               found: false
            };
         }
         
         return {
            found: true,
            module,
            name: refName,
            ref,
            refName
         };
      }
      else {
         let {module, name} = $.whereNameCame(srcModule, refName);
         if (module == null) {
            return {
               found: false
            };
         }
         else {
            return {
               found: true,
               module,
               name,
               ref,
               refName
            }
         }
      }
   }

   for (let ref of refs) {
      let {
         found,
         module: oModule,
         name: oEntry,
         ref: xref,
         refName
      } = originOf(ref);

      if (!found) {
         danglingRefs.push(ref);
         continue;
      }

      if (oModule === destModule) {
         // The reference "comes home"
         rename(xref, oEntry);
         continue;
      }

      // See whether the entry is already imported directly
      let {eimp, simp} = $.referabilityImports(oModule, oEntry, destModule);

      if (eimp) {
         rename(xref, $.importedAs(eimp));
         continue;
      }

      // If not imported directly then the oModule may have already been star-imported
      if (simp) {
         rename(xref, $.joindot(simp.alias, oEntry));
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
         offendingRefs.push(xref);
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
         else if ($.anyDefRefersTo(recp, $.joindot(simp.alias, entry))) {
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
   if ($.anyDefRefersTo(srcModule, entry, entry)) {
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
deleteEntry ::= function (module, name, cascade) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Entry named "${name}" does not exist`);
   }

   if ($.isNameUsedForImport(module, name)) {
      if (!cascade) {
         return false;
      }

      let recipients = $.recipientsOf(module, name);
      for (let imp of [...$.importsOf(module, name)]) {
         $.deleteImport(imp);
      }
      for (let recp of recipients) {
         $.saveObject(recp.importedNames);
      }
      $.saveObject($.imports);
   }

   $.deleteArrayItem(module.entries, module.entries.indexOf(name));
   $.deleteObject(module.defs[name]);
   $.deleteObjectProp(module.defs, name);
   $.rtset(module, name, $.delmark);

   return true;
}
