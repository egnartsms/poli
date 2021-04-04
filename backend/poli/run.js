bootstrap
   hasOwnProperty
   moduleEval
common
   dumpImportSection
   entryByName
   moduleByName
   moduleNames
delta
   computeDelta
exc
   ApiError
img2fs
   dumpModule
import
   import
   importFor
module
   addEntry
   entrySource
   editEntry
   targetIndex
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
reference
   isNameFree
transact
   commit
   rollback
-----
main ::= function (sendMessage) {
   $.sendMessage = sendMessage;
   return $.handleOperation;
}
handleOperation ::= function (op) {
   let stopwatch = (() => {
      let start = new Date;
      return () => {
         let elapsed = new Date - start;
         return `${elapsed} ms`;
      };
   })();

   try {      
      let ret = $.operationHandlers[op['op']].call(null, op['args']);
      let delta = $.computeDelta();
      if (delta.length > 0) {
         $.sendMessage({
            type: 'save',
            modifications: delta
         });
      }
      $.commit();
      $.respOk(ret);
      console.log(op['op'], `SUCCESS`, `(${stopwatch()})`);
   }
   catch (e) {
      // It is responsibility of the code itself to maintain correct state of all the
      // data structures when exceptions are thrown. Here, if things are corrup then this
      // is the bug with Poli itself, not the code the user is working on.
      console.error(e);

      $.rollback();

      let error, info;
      
      if (e instanceof $.ApiError) {
         error = e.error;
         info = e.info;
      }
      else {
         error = 'generic';
         info = {
            stack: e.stack,
            message: e.message
         };
      }

      $.respFailure(error, info);
      console.log(op['op'], `FAILURE`, `(${stopwatch()})`);
   }
}
sendMessage ::= null
respFailure ::= function (error, info) {
   $.sendMessage({
      type: 'resp',
      success: false,
      error: error,
      info: info
   });
}
respOk ::= function (result=null) {
   $.sendMessage({
      type: 'resp',
      success: true,
      result: result
   });
}
applyModifications ::= function (modifications) {
   console.log("Ignored ancient $.applyModifications() call");
   return;
   
   $.sendMessage({
      type: 'save',
      modifications: modifications
   });
}
operationHandlers ::= ({
   getModules: function () {
      return $.query.allModuleNames();
   },

   getEntries: function () {
      return $.query.allEntries();
   },

   getModuleEntries: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      return [...module.name2entry.keys()];
   },

   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      return $.moduleNames(module);
   },

   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, name);

      return $.entrySource(entry);
   },

   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);

      return $.query.getCompletions(module, star, prefix);
   },

   getImportables: function ({recp: recpModuleName}) {
      let recp = $.moduleByName(recpModuleName);

      return $.query.importablesInto(recp);
   },

   addEntry: function ({module: moduleName, name, source, anchor, before}) {
      let module = $.moduleByName(moduleName);
      let targetIndex = $.targetIndex(module, anchor, before);
      let normalizedSource = $.addEntry(module, name, source, targetIndex);

      return {
         normalizedSource: normalizedSource
      };
   },

   editEntry: function ({module: moduleName, name, newSource}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, name);
      let normalizedSource = $.editEntry(entry, newSource);

      return {
         normalizedSource: normalizedSource
      };
   },

   renameEntry: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, oldName);
      let modifiedModules = $.opRefactor.renameEntry(entry, newName);

      // $.applyModifications(
      //    Array.from(
      //       modifiedModules,
      //       ({module, modifiedEntries, importSectionAffected}) => ({
      //          module: module.name,
      //          modifiedEntries,
      //          importSection: importSectionAffected ? $.dumpImportSection(module) : null
      //       })
      //    )
      // );
   },

   removeEntry: function ({module: moduleName, entry, force}) {
      let module = $.moduleByName(moduleName);
      let {removed, affectedModules} = $.opRefactor.removeEntry(module, entry, force);
      
      if (!removed) {
         return {
            removed: false
         };
      }
      else {
         // $.applyModifications(
         //    Array.from(affectedModules, m => ({
         //       module: m.name,
         //       modifiedEntries: [],
         //       importSection: $.dumpImportSection(m),
         //    }))
         // );
         return {
            removed: true
         };
      }
   },

   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);
      $.opMove.moveBy1(module, name, direction);
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
      return $.opMove.moveEntry(srcModule, entry, destModule, anchor, before);
   },

   import: function ({recp: recpModuleName, donor: donorModuleName, name, alias}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);
      let entry = $.entryByName(donor, name);

      $.import(entry, recp, alias || entry.name);
      return $.dumpImportSection(recp);
   },

   removeUnusedImports: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      let removedCount = $.opImport.removeUnusedModuleImports(module);

      return {
         importSection: removedCount > 0 ? $.dumpImportSection(module) : null,
         removedCount
      };
   },

   removeUnusedImportsInAllModules: function () {
      let {removedCount, affectedModules} = $.opImport.removeUnusedImportsInAllModules();

      // $.applyModifications(
      //    Array.from(affectedModules, module => ({
      //       module: module.name,
      //       importSection: $.dumpImportSection(module),
      //       modifiedEntries: []
      //    }))
      // );
      return {
         removedCount
      };
   },

   renameImport: function ({module: moduleName, importedAs, newAlias}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }

      let modifiedEntries = $.opImport.renameImport(imp, newAlias || null);
      return {
         modifiedEntries: modifiedEntries || [],
         importSection: modifiedEntries === null ? null : $.dumpImportSection(module)
      };
   },

   removeImport: function ({module: moduleName, importedAs, force}) {
      let module = $.moduleByName(moduleName);
      let imp = $.importFor(module, importedAs);
      if (!imp) {
         throw new Error(`Not found imported entry: "${importedAs}"`);
      }

      let removed = $.opImport.removeImport(imp, force);
      
      if (!removed) {
         return {
            removed: false
         };
      }
      else {
         return {
            removed: true,
            importSection: $.dumpImportSection(module)
         };
      }
   },

   convertImportsToStar: function ({recp: recpModuleName, donor: donorModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);
      let modifiedEntries = $.opImport.convertImportsToStar(recp, donor);

      // if (modifiedEntries !== null) {
      //    $.applyModifications([{
      //       module: recp.name,
      //       modifiedEntries,
      //       importSection: $.dumpImportSection(recp)
      //    }]);
      // }
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

      return $.serialize(res);
   },

   addModule: function ({module: moduleName, lang}) {
      if (typeof lang !== 'string' || !['xs', 'js'].includes(lang)) {
         throw new Error(`Invalid module lang`);
      }

      $.opModule.addNewModule(moduleName, lang);
   },

   renameModule: function ({module: moduleName, newName}) {
      let module = $.moduleByName(moduleName);
      let affectedModules = $.opModule.renameModule(module, newName);
      
      // $.applyModifications(
      //    Array.from(affectedModules, module => ({
      //       module: module.name,
      //       modifiedEntries: [],
      //       importSection: $.dumpImportSection(module)
      //    }))
      // );
   },

   refreshModule: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      $.dumpModule(module);
   },

   removeModule: function ({module: moduleName, force}) {
      let module = $.moduleByName(moduleName);
      let connectedModuleNames = $.opModule.removeModule(module, force);

      return connectedModuleNames;
   },

   findReferences: function ({module: moduleName, star, name}) {
      let module = $.moduleByName(moduleName);
      return $.query.findReferences(module, star, name);
   },

   replaceUsages: function ({module: moduleName, name, newName}) {
      let module = $.moduleByName(moduleName);
      let modifiedEntries = $.opRefactor.replaceUsages(module, name, newName);
      return {
         importSection: null,
         modifiedEntries
      };
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
