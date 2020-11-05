bootstrap
   hasOwnProperty
   moduleEval
common
   dumpImportSection
   dumpImportSections
   moduleByName
   moduleNames
img2fs
   flushModule
import
   import
   importFor
op-edit
   addEntry
   editEntry
op-import
   * as: opImport
op-module
   * as: opModule
op-move
   * as: opMove
op-query
   * as: query
op-refactor
   * as: opRefactor
rt-rec
   applyRtDelta
   discardRtDelta
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
      $_.db.transaction(() => {
         $.operationHandlers[op['op']].call(null, op['args']);
      })();
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
operationHandlers ::= ({
   getModules: function () {
      $.opRet($.query.allModuleNames());
   },

   getEntries: function () {
      $.opRet($.query.allEntries());
   },

   getModuleEntries: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.opRet(module.entries);
   },

   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.opRet($.moduleNames(module));
   },

   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      
      if (!$.hasOwnProperty(module.defs, name)) {
         throw new Error(`Member "${name}" not found in module "${moduleName}"`);
      }

      $.opRet(module.defs[name].src);
   },

   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);
      $.opRet($.query.getCompletions(module, star, prefix));
   },

   getImportables: function ({recp: recpModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      $.opRet($.query.importablesInto(recp));
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
      let modifiedModules = $.opRefactor.renameEntry(module, oldName, newName);

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

   removeEntry: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let {removed, affectedModules} = $.opRefactor.removeEntry(module, name);
      
      if (!removed) {
         $.opRet(null);
      }
      else {
         $.opRet(Array.from(affectedModules, m => ({
            module: m.name,
            modifiedEntries: [],
            importSection: $.dumpImportSection(m)
         })));
      }
   },

   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);
      $.opMove.moveBy1(module, name, direction);
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
      $.opRet($.opMove.moveEntry(srcModule, entry, destModule, anchor, before));
   },

   import: function ({recp: recpModuleName, donor: donorModuleName, name, alias}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);
      $.import({
         recp,
         donor,
         name: name || null,
         alias: alias || null
      });
      $.opRet($.dumpImportSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      let removedCount = $.opImport.removeUnusedModuleImports(module);

      $.opRet({
         importSection: removedCount > 0 ? $.dumpImportSection(module) : null,
         removedCount
      });
   },

   removeUnusedImportsInAllModules: function () {
      let {removedCount, affectedModules} = $.opImport.removeUnusedImportsInAllModules();

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

      let modifiedEntries = $.opImport.renameImport(imp, newAlias || null);
      $.opRet({
         modifiedEntries: modifiedEntries || [],
         importSection: modifiedEntries === null ? null : $.dumpImportSection(module)
      });
   },

   removeImport: function ({module: moduleName, importedAs, force}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }

      let removed = $.opImport.removeImport(imp, force);
      
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

   convertImportsToStar: function ({recp: recpModuleName, donor: donorModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);
      let modifiedEntries = $.opImport.convertImportsToStar(recp, donor);

      if (modifiedEntries === null) {
         $.opRet([]);
      }
      else {
         $.opRet([{
            module: recp.name,
            modifiedEntries,
            importSection: $.dumpImportSection(recp)
         }]);
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

   addModule: function ({module: moduleName}) {
      $.opModule.addNewModule(moduleName);
      $.opRet();
   },

   renameModule: function ({module: moduleName, newName}) {
      let module = $.moduleByName(moduleName);
      let affectedModules = $.opModule.renameModule(module, newName);
      $.opRet($.dumpImportSections(affectedModules));
   },

   refreshModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.flushModule(module);
      $.opRet();
   },

   removeModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.opModule.removeModule(module);
      $.opRet();
   },

   findReferences: function ({module: moduleName, star, name}) {
      let module = $.moduleByName(moduleName);
      $.opRet($.query.findReferences(module, star, name));
   },

   replaceUsages: function ({module: moduleName, name, newName}) {
      let module = $.moduleByName(moduleName);
      let modifiedEntries = $.opRefactor.replaceUsages(module, name, newName);
      $.opRet({
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
