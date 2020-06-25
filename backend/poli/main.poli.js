aux
   * as auxiliary
   add as plus
   multiply as mult
-----
WebSocket ::= $_.require('ws')
port ::= 8080
server ::= null
ws ::= null
_init ::= function () {
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
   getDefinition: function ({name}) {
      $.opRet($m.defs[name].src);
   },

   getEntryNames: function () {
      $.opRet($m.names);
   },

   eval: function ({code}) {
      let res;

      try {
         res = $_.moduleEval($m, $, code);
      }
      catch (e) {
         $.opExc('replEval', {stack: e.stack});
         return;
      }

      $.opRet($.serialize(res));
   },

   edit: function ({name, newDefn}) {
      $[name] = $_.moduleEval($m, $, newDefn);

      let newDef = {
         type: 'native',
         src: newDefn
      };

      $_.db
         .prepare('update entry set def = :def where name = :name')
         .run({
            name: name,
            def: JSON.stringify(newDef)
         });

      $m.defs[name] = newDef;

      $.opRet();
   },

   rename: function ({oldName, newName}) {
      if (!(oldName in $m.defs)) {
         throw new Error(`Did not find an entry named "${oldName}"`);
      }
      if (newName in $m.defs) {
         throw new Error(`Cannot rename to "${newName}" because such an entry already exists`);
      }

      let {changes} = $_.db
         .prepare('update entry set name = :new_name where name = :old_name')
         .run({
            new_name: newName,
            old_name: oldName
         });

      if (changes !== 1) {
         throw new Error(`Internal error: entry named "${oldName}" is not in the DB`);
      }

      $m.names[$m.names.indexOf(oldName)] = newName;

      $m.defs[newName] = $m.defs[oldName];
      delete $m.defs[oldName];

      $m.name2id[newName] = $m.name2id[oldName];
      delete $m.name2id[oldName];

      $[newName] = $[oldName];
      delete $[oldName];

      $.opRet();
   },

   add: function ({name, defn, anchor, before}) {
      if (name in $m.defs) {
         throw new Error(`An entry named "${name}" already exists`);
      }

      let idx = $m.names.indexOf(anchor);
      if (idx === -1) {
         throw new Error(`Not found an entry "${anchor}"`);
      }

      $[name] = $_.moduleEval($m, $, defn);

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
            module_id: 2,
            name,
            def: JSON.stringify(def)
         });

      $.plugEntry($m, before ? idx : idx + 1, name);
      $m.defs[name] = def;      

      $.opRet();
   },

   delete: function ({name}) {
      if (!(name in $m.defs)) {
         throw new Error(`Entry named "${name}" does not exist`);
      }

      let idx = $m.names.indexOf(name);

      $.unplugEntry($m, idx);
      $_.db
         .prepare(
            `DELETE FROM entry WHERE module_id = :module_id AND name = :name`
         )
         .run({
            module_id: 2,
            name: name
         });

      delete $m.defs[name];
      delete $[name];

      $.opRet();
   },

   moveBy1: function ({name, direction}) {
      if (!(name in $m.defs)) {
         throw new Error(`Entry named "${name}" does not exist`);
      }

      if (direction !== 'up' && direction !== 'down') {
         throw new Error(`Invalid direction name: "${direction}"`);
      }

      let i = $m.names.indexOf(name);
      let j = direction === 'up' ?
               (i === 0 ? $m.names.length - 1 : i - 1) :
               (i === $m.names.length - 1 ? 0 : i + 1);

      $.unplugEntry($m, i);
      $.plugEntry($m, j, name);

      $.opRet();
   },

   move: function ({src, dest, before}) {
      if (!(src in $m.defs)) {
         throw new Error(`Entry named "${src}" does not exist`);
      }
      if (!(dest in $m.defs)) {
         throw new Error(`Entry named "${dest}" does not exist`);
      }

      let i = $m.names.indexOf(src);
      let j = $m.names.indexOf(dest);
      j = before ? j : j + 1;
      j = i < j ? j - 1 : j;

      $.unplugEntry($m, i);
      $.plugEntry($m, j, src);

      $.opRet();
   }

})
dbConnectEntries ::= function (moduleId, next, prev) {
   if (next == null) return;

   if (prev == null) {
      $_.db
         .prepare(
            `UPDATE entry SET prev_id = NULL
             WHERE module_id = :module_id AND name = :next`
         )
         .run({
            next,
            module_id: moduleId
         });
   }
   else {
      $_.db
         .prepare(
            `UPDATE entry SET prev_id = (
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
unplugEntry ::= function ($m, i) {
   $.dbConnectEntries($m.id, $m.names[i + 1], $m.names[i - 1]);
   $m.names.splice(i, 1);
}
plugEntry ::= function ($m, i, name) {
   $.dbConnectEntries($m.id, name, $m.names[i - 1]);
   $.dbConnectEntries($m.id, $m.names[i], name);
   $m.names.splice(i, 0, name);
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
