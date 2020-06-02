WebSocket ::= $_.require('ws')
Franchesca ::= 200
port ::= 8080
server ::= null
ws ::= null
db ::= null
_init ::= function (db) {
   $.db = db;
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
   edit: function ({name, newDefn}) {
      $[name] = $_.moduleEval(newDefn);

      let newDef = {
         type: 'native',
         src: newDefn
      };

      $.db
         .prepare('update entry set def = :def where name = :name')
         .run({
            name: name,
            def: JSON.stringify(newDef)
         });

      $d[name] = newDef;

      $.opReturn();
   },

   getDefinition: function ({name}) {
      $.opReturn($d[name].src);
   },

   rename: function ({oldName, newName}) {
      if (!(oldName in $d)) {
         throw new Error(`Did not find an entry named "${oldName}"`);
      }
      if (newName in $d) {
         throw new Error(`Cannot rename to "${newName}" because such an entry already exists`);
      }

      let {changes} = $.db
         .prepare('update entry set name = :new_name where name = :old_name')
         .run({
            new_name: newName,
            old_name: oldName
         });

      if (changes !== 1) {
         throw new Error(`Internal error: entry named "${oldName}" is not in the DB`);
      }

      let idx = $d[$_.names].indexOf(oldName);
      $d[$_.names][idx] = newName;

      $d[newName] = $d[oldName];
      delete $d[oldName];

      $[newName] = $[oldName];
      delete $[oldName];

      $.opReturn();
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
opReturn ::= function (result=null) {
   $.send({
      success: true,
      result: result
   });
}
