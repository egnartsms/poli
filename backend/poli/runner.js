common
   hasOwnProperty
   dumpImportSection
   moduleNames
exc
   ApiError
   genericError
img2fs
   dumpModule
import
   importFor
loader
   * as: loader
module
   entrySource
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
trie
   * as: trie
-----
main ::= function (sendMessage) {
   $.sendMessage = sendMessage;
   return $.handleOperation;
}

product ::= (a, b) => a * b

handleOperation ::= function (op) {
   let stopwatch = (() => {
      let start = new Date;
      return () => {
         let elapsed = new Date - start;
         return `${elapsed} ms`;
      };
   })();

   try {      
      $.operationHandlers[op['op']].call(null, $.loader.Rmodules, op['args']);
      console.log(op['op'], `SUCCESS`, `(${stopwatch()})`);
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

      $.sendMessage({
         type: 'resp',
         success: false,
         error: error,
         message: message,
         info: info,
      });

      console.error(e);
      console.log(op['op'], `FAILURE`, `(${stopwatch()})`);
   }
}
sendMessage ::= null
respond ::= function (result=null) {
   $.sendMessage({
      type: 'resp',
      success: true,
      result: result
   });
}
moduleByName ::= function (Rmodules, name) {
   let module = $.trie.search(Rmodules.byName, name);

   if (module === undefined) {
      throw $.genericError(`Unknown module name: '${name}'`);
   }

   return module;
}
operationHandlers ::= ({
   getModules: function () {
      $.respond($.query.allModuleNames());
   },

   getEntries: function () {
      $.respond($.query.allEntries());
   },

   getModuleEntries: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.respond(module.entries);
   },

   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.respond($.moduleNames(module));
   },

   getDefinition: function (Rmodules, {module: moduleName, name}) {
      let module = $.moduleByName(Rmodules, moduleName);
      let entry = $.trie.search(module.entries.byName, name);

      if (entry === undefined) {
         throw new Error(`Member "${name}" not found in module "${moduleName}"`);
      }

      $.respond(entry.strDef);
   },

   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);
      $.respond($.query.getCompletions(module, star, prefix));
   },

   getImportables: function ({recp: recpModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      $.respond($.query.importablesInto(recp));
   },

   addEntry: function ({module: moduleName, name, source, anchor, before}) {
      let module = $.moduleByName(moduleName);
      let normalizedSource = $.addEntry(module, name, source, anchor, before);

      $.respond({
         normalizedSource: normalizedSource
      });
   },

   editEntry: function ({module: moduleName, name, newSource}) {
      let module = $.moduleByName(moduleName);
      let normalizedSource = $.editEntry(module, name, newSource);

      $.respond({
         normalizedSource: normalizedSource
      });
   },

   renameEntry: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);
      let modifiedModules = $.opRefactor.renameEntry(module, oldName, newName);

      $.applyModifications(
         Array.from(
            modifiedModules,
            ({module, modifiedEntries, importSectionAffected}) => ({
               module: module.name,
               modifiedEntries,
               importSection: importSectionAffected ? $.dumpImportSection(module) : null
            })
         )
      );
      $.respond();
   },

   removeEntry: function ({module: moduleName, entry, force}) {
      let module = $.moduleByName(moduleName);
      let {removed, affectedModules} = $.opRefactor.removeEntry(module, entry, force);
      
      if (!removed) {
         $.respond({
            removed: false
         });
      }
      else {
         $.applyModifications(
            Array.from(affectedModules, m => ({
               module: m.name,
               modifiedEntries: [],
               importSection: $.dumpImportSection(m),
            }))
         );
         $.respond({
            removed: true
         });
      }
   },

   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);
      $.opMove.moveBy1(module, name, direction);
      $.respond();
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
      $.respond($.opMove.moveEntry(srcModule, entry, destModule, anchor, before));
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
      $.respond($.dumpImportSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      let removedCount = $.opImport.removeUnusedModuleImports(module);

      $.respond({
         importSection: removedCount > 0 ? $.dumpImportSection(module) : null,
         removedCount
      });
   },

   removeUnusedImportsInAllModules: function () {
      let {removedCount, affectedModules} = $.opImport.removeUnusedImportsInAllModules();

      $.applyModifications(
         Array.from(affectedModules, module => ({
            module: module.name,
            importSection: $.dumpImportSection(module),
            modifiedEntries: []
         }))
      );
      $.respond({
         removedCount
      });
   },

   renameImport: function ({module: moduleName, importedAs, newAlias}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }

      let modifiedEntries = $.opImport.renameImport(imp, newAlias || null);
      $.respond({
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
         $.respond({
            removed: false
         });
      }
      else {
         $.respond({
            removed: true,
            importSection: $.dumpImportSection(module)
         });
      }
   },

   convertImportsToStar: function ({recp: recpModuleName, donor: donorModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);
      let modifiedEntries = $.opImport.convertImportsToStar(recp, donor);

      if (modifiedEntries !== null) {
         $.applyModifications([{
            module: recp.name,
            modifiedEntries,
            importSection: $.dumpImportSection(recp)
         }]);
      }
      $.respond();
   },

   eval: function ({module: moduleName, code}) {
      let module = $.moduleByName(moduleName);

      let res;

      try {
         res = $.moduleEval(module, code);
      }
      catch (e) {
         throw new $.ApiError('repl-eval', {
            message: e.message,
            stack: e.stack,
         });
      }

      $.respond($.serialize(res));
   },

   addModule: function ({module: moduleName, lang}) {
      if (typeof lang !== 'string' || !['xs', 'js'].includes(lang)) {
         throw new Error(`Invalid module lang`);
      }

      $.opModule.addNewModule(moduleName, lang);
      $.respond();
   },

   renameModule: function ({module: moduleName, newName}) {
      let module = $.moduleByName(moduleName);
      let affectedModules = $.opModule.renameModule(module, newName);
      
      $.applyModifications(
         Array.from(affectedModules, module => ({
            module: module.name,
            modifiedEntries: [],
            importSection: $.dumpImportSection(module)
         }))
      );
      $.respond();
   },

   refreshModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.dumpModule(module);
      $.respond();
   },

   removeModule: function ({module: moduleName, force}) {
      let module = $.moduleByName(moduleName);
      let connectedModuleNames = $.opModule.removeModule(module, force);

      $.respond(connectedModuleNames);
   },

   findReferences: function ({module: moduleName, star, name}) {
      let module = $.moduleByName(moduleName);
      $.respond($.query.findReferences(module, star, name));
   },

   replaceUsages: function ({module: moduleName, name, newName}) {
      let module = $.moduleByName(moduleName);
      let modifiedEntries = $.opRefactor.replaceUsages(module, name, newName);
      $.respond({
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
