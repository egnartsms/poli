const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');


const {SRC_FOLDER, RUN_MODULE} = require('./const');
const loadModules = require('./load');
const readRawModules = require('./read-raw-modules');


function run() {
   let modules = loadModules(readRawModules());

   let handleOperation;
   let websocket = null;

   let server = http.createServer();
   let wss = new WebSocket.Server({ noServer: true });

   wss
      .on('error', function (error) {
         console.error("WebSocket server error:", error);
      })
      .on('connection', function (ws) {
         if (websocket !== null) {
            console.error("Double simultaneous connections from Sublime attempted");
            ws.close();
            return;
         }

         websocket = ws;
         websocket
            .on('message', function (data) {
               handleOperation(JSON.parse(data));
            })
            .on('close', function (code, reason) {
               websocket = null;
               console.log("Front-end disconnected. Code:", code, "reason:", reason);
            })
            .on('error', function (error) {
               console.error("WebSocket client connection error:", error);
            });

         console.log("Front-end connected");
      });

   server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws, request) => {
         wss.emit('connection', ws, request);
      });
   });

   // That's our protocol with RUN_MODULE:
   //   * we give it the way to send a message over the wire
   //   * it gives us operation handler which we call on incoming operation request
   handleOperation = modules[RUN_MODULE].rtobj['main'](
      message => websocket.send(JSON.stringify(message))
   );
   
   server.listen(8080);
}


if (require.main === module) {
   run();
}
