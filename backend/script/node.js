import http from 'http';
import fs from 'fs';
import {WebSocketServer} from 'ws';

import {SRC_FOLDER, RUN_MODULE} from '$/bootstrap/const.js';

import {readRawModules} from '$/bootstrap/read.js';
import {parseRawModule} from '$/bootstrap/parse.js';
import {loadModulesData} from '$/bootstrap/load.js';


function run() {
   let modulesData = Array.from(readRawModules(), parseRawModule);
   let namespaces = loadModulesData(modulesData);

   let handleOperation;
   let websocket = null;

   let server = http.createServer();
   let wss = new WebSocketServer({ noServer: true });

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
               console.log(
                  "Front-end disconnected. Code:", code, "reason:", reason.toString()
               );
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
   handleOperation = namespaces.get(RUN_MODULE)['main'](
      message => websocket.send(JSON.stringify(message))
   );
   
   server.listen(8080);
}


run();
