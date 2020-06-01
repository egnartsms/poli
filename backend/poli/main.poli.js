WebSocket ::= $_.require('ws')
irrelevant ::= null
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
