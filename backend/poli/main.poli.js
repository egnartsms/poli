WebSocket ::= $_.require('ws')
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
   console.log("Got this operation:", op);

   try {
      $.opHandlers[op['op']].call(null, op['args']);
   }
   catch (e) {
      $.opExc('generic', e.stack);
   }
}
opHandlers ::= {
   edit: function ({key, newSrc}) {
      newSrc = eval(newSrc);
      $[key] = $_.moduleEval(newSrc);
      let newDef = {
         type: 'native',
         src: newSrc
      };
      $.db
         .prepare('update entry set def = :def where name = :key')
         .run({
            key: key,
            def: JSON.stringify(newDef)
         });
      $d[key] = newDef;

      console.log("newDef", newDef);

      $.opReturn();
   },
}
send ::= function (msg) {
   $.ws.send(JSON.stringify(msg));
}
opExc ::= function (error, info) {
   $.send({
      type: 'result',
      success: false,
      error: error,
      info: info
   });
}
