bootstrap
   importEntry
   imports
   moduleEval
   modules
img2fs
   genModuleImportsSection
-----
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
   getModuleNames: function () {
      $.opRet(Object.keys($.modules));
   },

   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let def = module.defs[name];

      if (!def) {
         throw new Error(`Member "${name}" not found in module "${moduleName}"`);
      }

      $.opRet(def.src);
   },

   getEntries: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);

      $.opRet(module.entries);
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

   edit: function ({module: moduleName, name, newDefn}) {
      let module = $.moduleByName(moduleName);

      if (!module.defs[name]) {
         throw new Error(`Not found entry "${name}" in module "${moduleName}"`);
      }

      let newVal = $.moduleEval(module, newDefn);
      let newDef = {
         type: 'native',
         src: newDefn
      };
      
      module.rtobj[name] = newVal;
      module.defs[name] = newDef;

      for (let imp of $.importsOf(module, name)) {
         imp.recp.rtobj[imp.importedAs] = newVal;
      }

      $_.db
         .prepare(`
            UPDATE entry
            SET def = :def
            WHERE module_name = :module_name AND name = :name`
         )
         .run({
            module_name: module.name,
            name: name,
            def: JSON.stringify(newDef)
         });

      $.opRet();
   },

   rename: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);

      if (!(oldName in module.defs)) {
         throw new Error(`Did not find an entry named "${oldName}"`);
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

      let recipients = $.recipientsOf(module, oldName);

      // Renaming in DB is done by cascade, so we need to only do it in memory
      for (let imp of $.importsOf(module, oldName)) {
         $.renameImport(imp, newName);
      }

      $_.db
         .prepare(
            `UPDATE entry
             SET name = :new_name
             WHERE module_name = :module_name AND name = :old_name`
         )
         .run({
            module_name: module.name,
            new_name: newName,
            old_name: oldName
         });


      module.entries[module.entries.indexOf(oldName)] = newName;

      module.defs[newName] = module.defs[oldName];
      delete module.defs[oldName];

      module.rtobj[newName] = module.rtobj[oldName];
      delete module.rtobj[oldName];

      $.opRet($.importSectionForModules(recipients));
   },

   add: function ({module: moduleName, name, defn, anchor, before}) {
      let module = $.moduleByName(moduleName);

      if (name in module.defs) {
         throw new Error(`An entry named "${name}" already exists`);
      }

      let idx = module.entries.indexOf(anchor);
      if (idx === -1) {
         throw new Error(`Not found an entry "${anchor}"`);
      }

      module.rtobj[name] = $.moduleEval(module, defn);

      let def = {
         type: 'native',
         src: defn
      };

      $_.db
         .prepare(
            `INSERT INTO entry(module_name, name, def, prev)
             VALUES (:module_name, :name, :def, NULL)`
         )
         .run({
            module_name: module.name,
            name,
            def: JSON.stringify(def)
         });

      $.plugEntry(module, before ? idx : idx + 1, name);
      module.defs[name] = def;

      $.opRet();
   },

   delete: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);

      if ($.isNameImported(module, name)) {
         $.opRet(false);
      }
      else {
         $.deleteEntryCascade(module, name);
         $.opRet(true);
      }
   },

   deleteCascade: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let recipients = $.recipientsOf(module, name);

      $.deleteEntryCascade(module, name);

      $.opRet($.importSectionForModules(recipients));
   },

   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);

      if (!module.defs[name]) {
         throw new Error(`Entry named "${name}" does not exist`);
      }

      if (direction !== 'up' && direction !== 'down') {
         throw new Error(`Invalid direction name: "${direction}"`);
      }

      let i = module.entries.indexOf(name);
      let j = direction === 'up' ?
               (i === 0 ? module.entries.length - 1 : i - 1) :
               (i === module.entries.length - 1 ? 0 : i + 1);

      $.unplugEntry(module, i);
      $.plugEntry(module, j, name);

      $.opRet();
   },

   move: function ({module: moduleName, src, dest, before}) {
      let module = $.moduleByName(moduleName);

      if (!module.defs[src]) {
         throw new Error(`Entry named "${src}" does not exist`);
      }
      if (!module.defs[dest]) {
         throw new Error(`Entry named "${dest}" does not exist`);
      }

      let i = module.entries.indexOf(src);
      let j = module.entries.indexOf(dest);
      j = before ? j : j + 1;
      j = i < j ? j - 1 : j;

      $.unplugEntry(module, i);
      $.plugEntry(module, j, src);

      $.opRet();
   },

   getImportables: function ({recp: recpModuleName}) {
      function encodeEntry(module, entry) {
         return `${module.name}\0${entry}`;
      }

      function decodeEntry(encoded) {
         return encoded.split('\0');
      }

      let recp = $.moduleByName(recpModuleName);
      
      let importables = new Set;

      for (let moduleName in $.modules) {
         let module = $.modules[moduleName];
         if (module !== recp) {
            module.entries.forEach(e => importables.add(encodeEntry(module, e)));
         }
      }

      // Exclude those already imported
      for (let imp of $.imports) {
         if (imp.recp === recp) {
            importables.delete(encodeEntry(imp.donor, imp.name));
         }
      }

      $.opRet({
         importables: Array.from(importables, decodeEntry),
         disallowedNames: [...recp.entries, ...recp.importedNames]
      });
   },

   import: function ({recp: recpModuleName, donor: donorModuleName, name, alias}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);

      $.importEntry(recp, donor, name, alias);

      $_.db
         .prepare(`
            INSERT INTO import(recp_module_name, donor_module_name, name, alias) VALUES (
               :recp_module_name,
               :donor_module_name,
               :name,
               :alias
            )`
         )
         .run({
            recp_module_name: recp.name,
            donor_module_name: donor.name,
            name,
            alias
         });

      $.opRet($.dumpModuleImportSection(recp));
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

      for (let rec of $.imports) {
         if (rec.recp === module && !isUsed(module, rec.importedAs)) {
            unused.push(rec);
         }
      }

      for (let rec of unused) {
         $.deleteImportDb(rec);
      }

      $.opRet({
         importSection: unused.length > 0 ? $.dumpModuleImportSection(module) : null,
         removedCount: unused.length
      });
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
      let {lastInsertRowid: moduleId} = $_.db
         .prepare(`INSERT INTO module(name) VALUES (:name)`)
         .run({name: moduleName});
   },

   findReferences: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let {module: originModule, name: originName} = $.whereNameCame(module, name);
      let res = {
         [originModule.name]: originName
      };

      for (let imp of $.importsOf(originModule, originName)) {
         res[imp.recp.name] = imp.importedAs;
      }

      $.opRet(res);
   }

})
moduleByName ::= function (name) {
   let module = $.modules[name];
   if (!module) {
      throw new Error(`Unknown module name: ${name}`);
   }
   return module;
}
dbUpdatePrev ::= function (moduleName, prev, next) {
   if (next == null) return;

   $_.db
      .prepare(`
         UPDATE entry
         SET prev = :prev
         WHERE module_name = :module_name AND name = :next`
      )
      .run({prev, next, module_name: moduleName});
}
unplugEntry ::= function (module, i) {
   $.dbUpdatePrev(module.name, module.entries[i - 1], module.entries[i + 1]);
   module.entries.splice(i, 1);
}
plugEntry ::= function (module, i, name) {
   $.dbUpdatePrev(module.name, module.entries[i - 1], name);
   $.dbUpdatePrev(module.name, name, module.entries[i]);
   module.entries.splice(i, 0, name);
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
dumpModuleImportSection ::= function (module) {
   let pieces = [];
   for (let piece of $.genModuleImportsSection(module)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
importSectionForModules ::= function (modules) {
   let result = {};
   for (let module of modules) {
      result[module.name] = $.dumpModuleImportSection(module);
   }
   return result;
}
deleteImport ::= function (imp) {
   let {donor, recp} = imp;

   delete recp.rtobj[imp.importedAs];
   recp.importedNames.delete(imp.importedAs);
   $.imports.delete(imp);
}
deleteImportDb ::= function (imp) {
   $.deleteImport(imp);
   $_.db
      .prepare(`
         DELETE FROM import
         WHERE recp_module_name = :recp_module_name
           AND donor_module_name = :donor_module_name
           AND name = :name`
      )
      .run({
         recp_module_name: imp.recp.name,
         donor_module_name: imp.donor.name,
         name: imp.name
      });
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
renameImport ::= function (imp, newName) {
   if (imp.alias === null) {
      let {recp, name: oldName} = imp;

      recp.rtobj[newName] = recp.rtobj[oldName];
      delete recp.rtobj[oldName];
      recp.importedNames.delete(oldName);
      recp.importedNames.add(newName);
   }
   imp.name = newName;
}
deleteEntryCascade ::= function (module, name) {
   if (!module.defs[name]) {
      throw new Error(`Entry named "${name}" does not exist`);
   }

   // Imports will be deleted from DB by cascade. We need only delete them from memory
   Array.from($.importsOf(module, name)).forEach($.deleteImport);

   let idx = module.entries.indexOf(name);
   $.unplugEntry(module, idx);

   $_.db
      .prepare(
         `DELETE FROM entry WHERE module_name = :module_name AND name = :name`
      )
      .run({
         module_name: module.name,
         name: name
      });

   delete module.defs[name];
   delete module.rtobj[name];
}
importFor ::= function (module, name) {
   for (let imp of $.imports) {
      if (imp.recp === module && imp.importedAs === name) {
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
isNameImported ::= function (module, name) {
   let {done} = $.importsOf(module, name).next();
   return !done;
}
isNameFree ::= function (module, name) {
   return !(name in module.defs) && !module.importedNames.has(name);
}
recipientsOf ::= function (module, name) {
   let recps = new Set;
   for (let imp of $.importsOf(module, name)) {
      recps.add(imp.recp);
   }
   return Array.from(recps);
}
whereNameCame ::= function (module, name) {
   if (name in module.defs) {
      return {module, name};
   }
   if (module.importedNames.has(name)) {
      let imp = $.importFor(module, name);
      return {module: imp.donor, name: imp.name};
   }
   throw new Error(`Module "${module.name}": not known name "${name}"`);
}
