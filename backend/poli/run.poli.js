aux
   * as auxiliary
   add as plus
   multiply as mult
bootstrap
   importEntry
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
      });
}
handleOperation ::= function (op) {
   try {
      $.opHandlers[op['op']].call(null, op['args']);
      console.log(op['op']);
   }
   catch (e) {
      console.error(e);
      $.opExc('generic', {'stack': e.stack});
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
      $.opRet(Array.from($.modules, m => m.name));
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

   getImportableEntries: function ({recp: recpModuleName, donor: donorModuleName}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);

      let importable = new Set(Object.keys(donor.defs));
      for (let name in recp.defs) {
         importable.delete(name);
      }
      for (let name of recp.importedNames) {
         importable.delete(name);
      }

      $.opRet(Array.from(importable));
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
            WHERE module_id = :module_id AND name = :name`
         )
         .run({
            module_id: module.id,
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
             WHERE module_id = :module_id AND name = :old_name`
         )
         .run({
            module_id: module.id,
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
            `INSERT INTO entry(module_id, name, def, prev_id)
             VALUES (:module_id, :name, :def, NULL)`
         )
         .run({
            module_id: module.id,
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
            `DELETE FROM entry WHERE module_id = :module_id AND name = :name`
         )
         .run({
            module_id: module.id,
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

   import: function ({recp: recpModuleName, donor: donorModuleName, entryName}) {
      let recp = $.moduleByName(recpModuleName);
      let donor = $.moduleByName(donorModuleName);

      $.importEntry(recp, donor, entryName, null);

      $_.db
         .prepare(`
            INSERT INTO import(recp_module_id, donor_entry_id, alias) VALUES (
               :recp_module_id,
               (SELECT id
                FROM entry
                WHERE module_id = :donor_module_id AND name = :entry_name),
               NULL
            )`
         )
         .run({
            recp_module_id: recp.id,
            donor_module_id: donor.id,
            entry_name: entryName
         });

      $.opRet($.dumpModuleImportsSection(recp));
   },

   addModule: function ({module: moduleName}) {
      let {lastInsertRowid: moduleId} = $_.db
         .prepare(`INSERT INTO module(name) VALUES (:name)`)
         .run({name: moduleName});



   }

})
moduleByName ::= function (name) {
   let module = $.modules.find(m => m.name === name);
   if (!module) {
      throw new Error(`Unknown module name: ${name}`);
   }
   return module;
}
dbConnectEntries ::= function (moduleId, prev, next) {
   if (next == null) return;

   if (prev == null) {
      $_.db
         .prepare(`
            UPDATE entry SET prev_id = NULL
            WHERE module_id = :module_id AND name = :next`
         )
         .run({
            next,
            module_id: moduleId
         });
   }
   else {
      $_.db
         .prepare(`
            UPDATE entry SET prev_id = (
               SELECT e.id
               FROM entry e
               WHERE e.module_id = module_id AND e.name = :prev
            )
            WHERE module_id = :module_id AND name = :next`
         )
         .run({
            prev, next,
            module_id: moduleId
         });
   }
}
unplugEntry ::= function (module, i) {
   $.dbConnectEntries(module.id, module.entries[i - 1], module.entries[i + 1]);
   module.entries.splice(i, 1);
}
plugEntry ::= function (module, i, name) {
   $.dbConnectEntries(module.id, module.entries[i - 1], name);
   $.dbConnectEntries(module.id, name, module.entries[i]);
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
