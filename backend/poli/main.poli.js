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
opHandlers ::= ({
   getDefinition: function ({name}) {
      $.opRet($m.defs[name].src);
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

   add: function ({after, before, name, defn}) {
      function notFound(name) {
         throw new Error(`Not found an entry "${name}"`);
      }

      if (name in $m.defs) {
         throw new Error(`An entry named "${name}" already exists`);
      }

      let idx, prevId, nextId;

      if (after) {
         idx = $m.names.indexOf(after);
         if (idx === -1) {
            notFound(after);
         }
         idx += 1;
         prevId = $m.name2id[after];
         if (idx < $m.names.length) {
            nextId = $m.name2id[$m.names[idx]]
         }
         else {
            nextId = null;
         }
      }
      else if (before) {
         idx = $m.names.indexOf(before);
         if (idx === -1) {
            notFound(before);
         }
         nextId = $m.name2id[before];
         if (idx === 0) {
            prevId = null;
         }
         else {
            prevId = $m.name2id[$m.names[idx - 1]]
         }
      }
      else {
         throw new Error(`Misuse: neither "after" nor "before" specified`);
      }

      $[name] = $_.moduleEval($m, $, defn);

      let def = {
         type: 'native',
         src: defn
      };

      let {lastInsertRowid: id} = $_.db
         .prepare(`insert into entry(module_id, name, def, prev_id)
                   values (:module_id, :name, :def, :prev_id)`)
         .run({
            module_id: 1,
            name,
            def: JSON.stringify(def),
            prev_id: prevId
         });

      if (nextId !== null) {
         $_.db
            .prepare(`update entry set prev_id = :prev_id where id = :id`)
            .run({
               id: nextId,
               prev_id: id
            });         
      }

      $m.defs[name] = def;
      $m.names.splice(idx, 0, name);
      $m.name2id[name] = id;

      $.opRet();
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
   }

})
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
serialize ::= function (obj) {
   const inds = '   ';

   function* serializeObject(object) {
      let entries = Object.entries(object);

      if (entries.length === 0) {
         yield '{}';
         return;
      }

      yield '{\n';
      for (let [key, val] of entries) {
         yield inds.repeat(1);
         yield key;
         yield ': ';
         yield* serialize(val, false);
         yield ',\n';
      }
      yield inds.repeat(0);
      yield '}';
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
