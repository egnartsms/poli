bootstrap
   addRecordedObjects
   importEntry
   importModule
   imports
   isObject
   makeModule
   metaRef
   moduleEval
   modules
   obj2id
   objrefRecorder
   saveObjectAddCascade
   stmtInsert
   stmtUpdate
   takeNextOid
   toJson
img2fs
   genModuleImportSection
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
      console.log(op['op'], `SUCCESS`, `(${stopwatch()})`);
   }
   catch (e) {
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
         res.push([module.name, null]);

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

         module.rtobj[name] = $.moduleEval(module, defn);
         module.entries.push(name);
      }
      else {
         let idx = module.entries.indexOf(anchor);
         if (idx === -1) {
            throw new Error(`Not found an entry "${anchor}"`);
         }

         module.rtobj[name] = $.moduleEval(module, defn);
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

      if (!module.defs[name]) {
         throw new Error(`Not found entry "${name}" in module "${moduleName}"`);
      }

      let newVal = $.moduleEval(module, newDefn);

      $.deleteObject(module.defs[name]);
      $.setObjectProp(module.defs, name, {
         type: 'native',
         src: newDefn
      });
      module.rtobj[name] = newVal;

      for (let imp of $.importsOf(module, name)) {
         imp.recp.rtobj[$.importedAs(imp)] = newVal;
      }

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

      let modifiedModules = $.updateRecipientsForRename(module, oldName, newName);
      let modifiedEntries = $.updateModuleForRename(module, oldName, newName);

      modifiedModules.unshift({
         module,
         modifiedEntries,
         importSectionAffected: false
      });

      $.setObjectProp(module.entries, module.entries.indexOf(oldName), newName);
      $.setObjectProp(module.defs, newName, module.defs[oldName]);
      $.deleteObjectProp(module.defs, oldName);

      module.rtobj[newName] = module.rtobj[oldName];
      delete module.rtobj[oldName];

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
      srcEntry,
      destModule: destModuleName,
      destEntry,
      before
   }) {
      let srcModule = $.moduleByName(srcModuleName);
      let destModule = $.moduleByName(destModuleName);

      if (!$.hasOwnProperty(srcModule.defs, srcEntry)) {
         throw new Error(`Entry "${srcEntry}" does not exist in "${srcModuleName}"`);
      }
      if (!$.hasOwnProperty(destModule.defs, destEntry)) {
         throw new Error(`Entry "${destEntry}" does not exist in "${destModuleName}"`);
      }
      if (!$.isNameFree(destModule, srcEntry)) {
         throw new Error(`Cannot move entry because of name clash`);
      }

      // Figure out whether it would be possible to pull all the dependency along with
      // the entry
      function dotRefs(src) {
         let names = new Set();
         let re = /\$\.([0-9a-zA-Z_]+(?:\.[0-9a-zA-Z_]+)?)/g;

         for (let [, ref] of src.matchAll(re)) {
            names.add(ref);
         }

         return names;
      }

      let oldCode = srcModule.defs[srcEntry].src;
      let refs = dotRefs(oldCode);
      let offendingRefs = [];
      let renameMap = new Map;
      let toImport = [];
      let danglingRefs = [];

      function rename(from, to) {
         if (from !== to) {
            renameMap.set(from, to);
         }
      }

      function originOf([refModule, refName]) {
         if (refModule !== null) {
            let {module, name: mustBeNull} = $.whereNameCame(srcModule, refModule);
            if (!module || mustBeNull !== null || !$.hasOwnProperty(module.defs, refName)) {
               return {};
            }
            return {module, name: refName};
         }
         else {
            return $.whereNameCame(srcModule, refName);
         }
      }

      function splitRef(ref) {
         let pref = ref.split('.');
         if (pref.length === 1) {
            pref.unshift(null);
         }
         return pref;
      }

      for (let ref of refs) {
         let refPair = splitRef(ref);
         let {module: oModule, name: oEntry} = originOf(refPair);

         if (!oEntry) {
            danglingRefs.push(ref);
            continue;
         }

         if (oModule === destModule) {
            // The reference "comes home". Works in case of module import, too.
            rename(ref, oEntry);
            continue;
         }

         // See whether the entry is already imported directly
         let imp = $.importFromTo(oModule, oEntry, destModule);

         if (imp) {
            rename(ref, $.importedAs(imp));
            continue;
         }

         // If not imported directly then the oModule may have already been star-imported
         let starImp = $.importFromTo(oModule, null, destModule);

         if (starImp) {
            rename(ref, `${starImp.alias}.${oEntry}`);
            continue;
         }

         // Must import it directly then
         if ($.isNameFree(destModule, refPair[1])) {
            toImport.push([oModule, oEntry, refPair[1]]);
         }
         else {
            offendingRefs.push(ref);
         }
      }

      if (offendingRefs.length > 0) {
         $.opRet({
            moved: false,
            offendingRefs
         });
         return;
      }

      let newCode;

      if (renameMap.size > 0) {
         let alts = 
            Array.from(renameMap.keys(), r => `(?:${r.replace(/\./g, '\\.')})`)
            .join('|');
         let sre = `(?<=\\$\\.)${alts}`;
         let re = new RegExp(sre, 'g');

         newCode = oldCode.replace(re, ref => renameMap.get(ref));
      }
      else {
         newCode = oldCode;
      }

      if (toImport.length > 0) {
         for (let [oModule, oEntry, importAs] of toImport) {
            $.importEntry(
               destModule, oModule, oEntry, importAs === oEntry ? null : importAs
            );
         }

         $.saveObject(destModule.importedNames);
         $.saveObjectAddCascade($.imports);
      }

      let def = srcModule.defs[srcEntry];
      $.deleteObjectProp(srcModule.defs, srcEntry);
      delete srcModule.rtobj[srcEntry];

      let newVal = $.moduleEval(destModule, newCode);
      destModule.rtobj[srcEntry] = newVal;
      if (newCode !== oldCode) {
         $.deleteObject(def);
         def = {
            type: 'native',
            src: newCode
         };
      }
      $.setObjectProp(destModule.defs, srcEntry, def);

      let iSrc = srcModule.entries.indexOf(srcEntry);
      srcModule.entries.splice(iSrc, 1);
      $.saveObject(srcModule.entries);

      let iDest = destModule.entries.indexOf(destEntry);
      iDest = before ? iDest : iDest + 1;
      destModule.entries.splice(iDest, 0, srcEntry);
      $.saveObject(destModule.entries);

      $.opRet({
         moved: true,
         newCode: newCode,
         importSection: toImport.length > 0 ? $.dumpImportSection(destModule) : null,
         danglingRefs
      });
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

      if (name === null) {
         $.importModule(recp, donor, alias);
      }
      else {
         $.importEntry(recp, donor, name, alias);
      }

      $.saveObject(recp.importedNames);
      $.saveObjectAddCascade($.imports);

      $.opRet($.dumpImportSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      function isUsed(module, name) {
         name = '$.' + name;

         for (let {src} of Object.values(module.defs)) {
            if (src.includes(name)) {
               return true;
            }
         }

         return false;
      }

      let module = $.moduleByName(moduleName);

      let unused = [];

      for (let imp of $.imports) {
         if (imp.recp === module && !isUsed(module, $.importedAs(imp))) {
            unused.push(imp);
         }
      }

      for (let imp of unused) {
         $.deleteImportDontSave(imp);
         $.deleteObject(imp);
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
   }

})
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
importedAs ::= function (imp) {
   return imp.alias || imp.name;
}
moduleByName ::= function (name) {
   let module = $.modules[name];
   if (!module) {
      throw new Error(`Unknown module name: ${name}`);
   }
   return module;
}
toJsonRef ::= function (obj, objref) {
   // Convert to JSON but use reference even for obj itself
   if ($.isObject(obj)) {
      obj = objref(obj);
   }

   return JSON.stringify(obj);
}
jsonPath ::= function (...things) {
   let pieces = ['$'];
   for (let thing of things) {
      if (typeof thing === 'string') {
         pieces.push('.' + thing);
      }
      else if (typeof thing === 'number') {
         pieces.push(`[${thing}]`);
      }
      else {
         throw new Error(`Invalid JSON path item: ${thing}`);
      }
   }

   return pieces.join('');
}
objrefMustExist ::= function (obj) {
   let oid = $.obj2id.get(obj);
   if (oid == null) {
      throw new Error(`Stumbled upon an unsaved object: ${obj}`);
   }

   return {
      [$.metaRef]: oid
   };
}
saveObject ::= function (obj) {
   $.assert($.isObject(obj));

   let oid = $.obj2id.get(obj);
   let json = $.toJson(obj, $.objrefMustExist);

   if (oid == null) {
      oid = $.takeNextOid();
      $.stmtInsert.run({oid, val: json});
      $.obj2id.set(obj, oid);
   }
   else {
      $.stmtUpdate.run({oid, val: json});
   }
}
stmtSetProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_set(val, :path, json(:propval)) WHERE id = :oid
`)
setObjectProp ::= function (obj, prop, val) {
   $.assert($.obj2id.has(obj));

   let oid = $.obj2id.get(obj);
   let rec = $.objrefRecorder();
   let json = $.toJsonRef(val, rec.objref);

   $.stmtSetProp.run({
      oid,
      path: $.jsonPath(prop),
      propval: json
   });

   $.addRecordedObjects(rec);

   obj[prop] = val;
}
stmtDeleteProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_remove(val, :path) WHERE id = :oid
`)
deleteObjectProp ::= function (obj, prop) {
   $.assert($.obj2id.has(obj));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(obj),
      path: $.jsonPath(prop),
   });
   delete obj[prop];   
}
deleteArrayItem ::= function (ar, i) {
   $.assert($.obj2id.has(ar));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(ar),
      path: $.jsonPath(i),
   });
   ar.splice(i, 1);
}
stmtDelete ::= $_.db.prepare(`
   DELETE FROM obj WHERE id = :oid
`)
deleteObject ::= function (obj) {
   $.assert($.obj2id.has(obj));

   $.stmtDelete.run({oid: $.obj2id.get(obj)});
   $.obj2id.delete(obj);
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
   return $.updateModuleForRename(recp, oldName, newName);
}
renameImportedName ::= function (recp, oldName, newName) {
   recp.rtobj[newName] = recp.rtobj[oldName];
   delete recp.rtobj[oldName];

   recp.importedNames.delete(oldName);
   recp.importedNames.add(newName);
   $.saveObject(recp.importedNames);
}
deleteImportDontSave ::= function (imp) {
   let {recp} = imp;

   delete recp.rtobj[$.importedAs(imp)];
   recp.importedNames.delete($.importedAs(imp));
   $.imports.delete(imp);
}
updateImportForRename ::= function (imp, newName) {
   if (imp.alias === null) {
      $.renameImportedName(imp.recp, imp.name, newName);
   }
   $.setObjectProp(imp, 'name', newName);
}
updateModuleForRename ::= function (module, oldName, newName, {
   starName = null,
   directToo = false
} = {}) {
   let mi;

   if (starName === null) {
      mi = '';
   }
   else if (directToo) {
      mi = `(?:${starName}\\.)?`;
   }
   else {
      mi = `(?:${starName}\\.)`;
   }

   let re = new RegExp(`(?<=\\$\\.${mi})${oldName}`, 'g');
   let modifiedEntries = [];

   for (let entry of module.entries) {
      let oldCode = module.defs[entry].src;
      let newCode = oldCode.replace(re, () => newName);
      
      if (oldCode === newCode) {
         continue;
      }

      let newVal = $.moduleEval(module, newCode);

      module.rtobj[entry] = newVal;

      $.deleteObject(module.defs[entry]);
      $.setObjectProp(module.defs, entry, {
         type: 'native',
         src: newCode
      });

      modifiedEntries.push([entry, newCode]);
   }

   return modifiedEntries;
}
updateRecipientsForRename ::= function (module, oldName, newName) {
   let direct = new Map;
   let star = new Map;

   for (let imp of $.importsOf(module, oldName)) {
      direct.set(imp.recp, imp.alias === null);
      $.updateImportForRename(imp, newName);
   }

   for (let imp of $.starImportsOf(module)) {
      star.set(imp.recp, imp.alias);
   }

   let recps = new Set([...direct.keys(), ...star.keys()]);
   let modifiedModules = [];

   for (let recp of recps) {
      let modifiedEntries = $.updateModuleForRename(recp, oldName, newName, {
         starName: star.get(recp) || null,
         directToo: direct.get(recp)
      });
      modifiedModules.push({
         module: recp,
         modifiedEntries,
         importSectionAffected: direct.has(recp)
      });
   }

   return modifiedModules;
}
deleteEntry ::= function (module, name, cascade) {
   if (!$.hasOwnProperty(module.defs, name)) {
      throw new Error(`Entry named "${name}" does not exist`);
   }

   if ($.isNameImported(module, name)) {
      if (!cascade) {
         return false;
      }

      let recipients = $.recipientsOf(module, name);
      for (let imp of [...$.importsOf(module, name)]) {
         $.deleteImportDontSave(imp);
         $.deleteObject(imp);
      }
      for (let recp of recipients) {
         $.saveObject(recp.importedNames);
      }
      $.saveObject($.imports);
   }

   $.deleteArrayItem(module.entries, module.entries.indexOf(name));
   $.deleteObject(module.defs[name]);
   $.deleteObjectProp(module.defs, name);
   delete module.rtobj[name];   

   return true;
}
importFor ::= function (module, name) {
   for (let imp of $.imports) {
      if (imp.recp === module && $.importedAs(imp) === name) {
         return imp;
      }
   }
   return null;
}
importsOf ::= function* (module, name) {
   for (let imp of $.imports) {
      if (imp.donor === module && imp.name === name) {
         yield imp;
      }
   }
}
starImportsOf ::= function* (module) {
   for (let imp of $.imports) {
      if (imp.donor === module && imp.name === null) {
         yield imp;
      }
   }
}
importFromTo ::= function (donor, name, recp) {
   for (let imp of $.imports) {
      if (imp.donor === donor && imp.recp === recp && imp.name === name) {
         return imp;
      }
   }
   return null;
}
isNameImported ::= function (module, name) {
   let {done} = $.importsOf(module, name).next();
   return !done;
}
isNameFree ::= function (module, name) {
   return !($.hasOwnProperty(module.defs, name) || module.importedNames.has(name));
}
recipientsOf ::= function (module, name) {
   let recps = new Set;
   for (let imp of $.importsOf(module, name)) {
      recps.add(imp.recp);
   }
   return Array.from(recps);
}
whereNameCame ::= function (module, name) {
   if ($.hasOwnProperty(module.defs, name)) {
      return {module, name};
   }

   if (module.importedNames.has(name)) {
      let imp = $.importFor(module, name);
      return {module: imp.donor, name: imp.name};
   }

   return {};
}
