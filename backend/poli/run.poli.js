aux
   * as auxiliary
   add as plus
   multiply as mult
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
      $.opExc('generic', {'stack': e.stack});
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
         $.opExc('replEval', {stack: e.stack});
         return;
      }

      $.opRet($.serialize(res));
   },

   edit: function ({module: moduleName, name, newDefn}) {
      let module = $.moduleByName(moduleName);

      if (!module.defs[name]) {
         throw new Error(`Not found entry "${name}" in module "${moduleName}"`);
      }

      module.rtobj[name] = $.moduleEval(module, newDefn);

      let newDef = {
         type: 'native',
         src: newDefn
      };

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

      module.defs[name] = newDef;

      $.opRet();
   },

   rename: function ({module: moduleName, oldName, newName}) {
      let module = $.moduleByName(moduleName);

      if (!(oldName in module.defs)) {
         throw new Error(`Did not find an entry named "${oldName}"`);
      }
      if (newName in module.defs) {
         throw new Error(`Cannot rename to "${newName}" because such an entry already exists`);
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

      $.opRet();
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

      if (!module.defs[name]) {
         throw new Error(`Entry named "${name}" does not exist`);
      }

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

      $.opRet();
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

      $.opRet($.dumpModuleImportsSection(recp));
   },

   removeUnusedImports: function ({module: moduleName}) {
      function isUsed(name) {
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
         if (rec.recp === module && !isUsed(rec.importedAs)) {
            unused.push(rec);
         }
      }

      for (let rec of unused) {
         $.unimportRecord(rec);
      }

      $.opRet({
         importSection: unused.length > 0 ? $.dumpModuleImportsSection(module) : null,
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
dumpModuleImportsSection ::= function (module) {
   let pieces = [];
   for (let piece of $.genModuleImportsSection(module)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
unimportRecord ::= function (imp) {
   delete imp.recp.rtobj[imp.importedAs];
   imp.recp.importedNames.delete(imp.importedAs);
   $.imports.delete(imp);
   $_.db
      .prepare(`
         DELETE FROM import
         WHERE recp_module_name = :recp_module_name
           AND donor_module_name = :donor_module_name
           AND name = :name`)
      .run({
         recp_module_name: imp.recp.name,
         donor_module_name: imp.donor.name,
         name: imp.name
      });
}
