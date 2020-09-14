bootstrap
   hasOwnProperty
   imports
   moduleEval
   modules
   saveObject
common
   dumpImportSection
   dumpImportSections
   joindot
   moduleByName
img2fs
   flushModule
import
   addImport
   deleteImport
   importFor
   importedAs
   importsOf
   isEntryImportedByAnyone
   recipientsOf
   starImportsOf
op-edit
   addEntry
   editEntry
op-import
   removeImport
   removeUnusedImportsInAllModules
   removeUnusedModuleImports
   renameImport
op-module
   addNewModule
   removeModule
   renameModule
op-move
   moveBy1
   moveEntry
op-query
   * as query
op-rename-entry
   renameEntry
   renameRefsIn
persist
   deleteArrayItem
   deleteObject
   deleteObjectProp
reference
   isNameFree
   resolveReference
   whereNameCame
rt-rec
   applyRtDelta
   delmark
   discardRtDelta
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
      $.opRet($.query.allModuleNames());
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

   addEntry: function ({module: moduleName, name, defn, anchor, before}) {
      let module = $.moduleByName(moduleName);
      $.addEntry(module, name, defn, anchor, before);
      $.opRet();
   },

   editEntry: function ({module: moduleName, name, newDefn}) {
      let module = $.moduleByName(moduleName);
      $.editEntry(module, name, newDefn);
      $.opRet();
   },

   renameEntry: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);
      let modifiedModules = $.renameEntry(module, oldName, newName);

      $.opRet(
         Array.from(
            modifiedModules,
            ({module, modifiedEntries, importSectionAffected}) => ({
               module: module.name,
               modifiedEntries,
               importSection: importSectionAffected ? $.dumpImportSection(module) : null
            })
         )
      );
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
      $.moveBy1(module, name, direction);
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

      $.addImport({recp, donor, name: name || null, alias: alias || null});

      $.saveObject(recp.importedNames);
      $.saveObject($.imports);

      $.opRet($.dumpImportSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      let removedCount = $.removeUnusedModuleImports(module);

      $.opRet({
         importSection: removedCount > 0 ? $.dumpImportSection(module) : null,
         removedCount
      });
   },

   removeUnusedImportsInAllModules: function () {
      let {removedCount, affectedModules} = $.removeUnusedImportsInAllModules();

      $.opRet({
         removedCount,
         modifiedModules: Array.from(affectedModules, module => ({
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
      if (importedAs === (newAlias || imp.name)) {
         $.opRet({
            modifiedEntries: [],
            importSection: null
         });
         return;
      }

      let modifiedEntries = $.renameImport(imp, newAlias);
      $.opRet({
         modifiedEntries: modifiedEntries || [],
         importSection: $.dumpImportSection(module)
      });
   },

   removeImport: function ({module: moduleName, importedAs, force}) {
      let module = $.moduleByName(moduleName);
      let removed = $.removeImport(module, importedAs, force);
      
      if (!removed) {
         $.opRet({
            removed: false
         });
      }
      else {
         $.opRet({
            removed: true,
            importSection: $.dumpImportSection(module)
         });
      }
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

   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);

      let targetModule;

      if (star !== null) {
         let simp = $.importFor(module, star);
         if (!simp) {
            $.opRet([]);
            return;
         }
         targetModule = simp.donor;
      }
      else {
         targetModule = module;
      }

      let res = [];

      for (let name of [...targetModule.entries, ...targetModule.importedNames]) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      $.opRet(res);
   },

   addModule: function ({module: moduleName}) {
      $.addNewModule(moduleName);
      $.opRet();
   },

   renameModule: function ({module: moduleName, newName}) {
      let module = $.moduleByName(moduleName);
      let affectedModules = $.renameModule(module, newName);
      $.opRet($.dumpImportSections(affectedModules));
   },

   refreshModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.flushModule(module);
      $.opRet();
   },

   removeModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.removeModule(module);
      $.opRet();
   },

   findReferences: function ({module: moduleName, star, name}) {
      let module = $.moduleByName(moduleName);
      let {
         found,
         module: oModule,
         name: oName
      } = $.resolveReference(module, star, name);

      if (!found) {
         $.opRet(null);
         return;
      }

      let res = [[oModule.name, oName]];

      for (let imp of $.importsOf(oModule, oName)) {
         res.push([imp.recp.name, $.importedAs(imp)]);
      }

      for (let imp of $.starImportsOf(oModule)) {
         res.push([imp.recp.name, $.joindot(imp.alias, oName)])
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
deleteEntry ::= function (module, name, cascade) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Entry named "${name}" does not exist`);
   }

   if ($.isEntryImportedByAnyone(module, name)) {
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
