import http from 'http';
import fs from 'fs';
import {WebSocketServer} from 'ws';
import url from 'url';

import {SRC_FOLDER, RUN_MODULE} from '$/bootstrap/const.js';
import {readRawModules} from '$/bootstrap/read.js';


function run() {
   let server = http.createServer();
   let wssBrowser = new WebSocketServer({ noServer: true });
   let wssSublime = new WebSocketServer({ noServer: true });

   let wsBrowser = null;
   let wsSublime = null;

   wssSublime
      .on('error', function (error) {
         console.error("Sublime websocket server error:", error);
      })
      .on('connection', function (ws) {
         if (wsSublime !== null) {
            console.error("Double simultaneous connections from Sublime attempted");
            ws.close();
            return;
         }

         wsSublime = ws;
         wsSublime
            .on('close', function (code, reason) {
               wsSublime = null;
               console.log(
                  "Sublime disconnected. Code:", code, "reason:", reason.toString()
               );
            })
            .on('error', function (error) {
               console.error("Sublime websocket connection error:", error);
            })
            .on('message', (data) => {
               if (wsBrowser !== null) {
                  console.log('sublime -> browser');
                  wsBrowser.send(data);
               }
               else {
                  console.log('sublime -> 0');
                  // This needs to be kept in-sync with our messaging format, which is bad
                  wsSublime.send(JSON.stringify({
                     type: 'resp',
                     success: false,
                     error: 'not-connected',
                     info: {
                        message: "The browser is not connected"
                     }
                  }));
               }
            });

         console.log("Sublime connected");
      });

   wssBrowser
         .on('error', function (error) {
            console.error("Browser websocket server error:", error);
         })
         .on('connection', function (ws) {
            if (wsBrowser !== null) {
               console.error("Double simultaneous connections from Browser attempted");
               ws.close();
               return;
            }

            wsBrowser = ws;
            wsBrowser
               .on('close', function (code, reason) {
                  wsBrowser = null;
                  console.log(
                     "Browser disconnected. Code:", code, "reason:", reason.toString()
                  );
               })
               .on('error', function (error) {
                  console.error("Browser websocket connection error:", error);
               })
               .on('message', (data) => {
                  if (wsSublime !== null) {
                     console.log('browser -> sublime');
                     wsSublime.send(data);
                  }
                  else {
                     console.log('browser -> 0');
                  }
               });

            console.log("Browser connected");
         });

   server.on('upgrade', (req, socket, head) => {
      const pathname = url.parse(req.url).pathname;

      let wss;

      if (pathname === '/sublime') {
         wss = wssSublime;
      }
      else if (pathname === '/browser') {
         wss = wssBrowser;
      }
      else {
         console.error(`Unexpected WS request pathname: ${pathname}`);
         socket.destroy();
      }

      wss.handleUpgrade(req, socket, head, (ws, req) => {
         wss.emit('connection', ws, req);
      });
   });

   server.on('request', (req, resp) => {
      const pathname = url.parse(req.url).pathname;

      if (pathname === '/') {
         resp.writeHead(200, {
            'content-type': 'text/html'
         });
         resp.end(fs.readFileSync('index.html', 'utf8'));
      }
      else if (pathname === '/bootstrap') {
         let rawModules = readRawModules();
         let bootloader = fs
            .readFileSync('./gen/loader.js', 'utf8')
            .replace(/\/\*RAW_MODULES\*\//, () => JSON.stringify(rawModules, null, 2));

         resp.writeHead(200, {
            'content-type': 'text/javascript'
         });
         resp.end(bootloader);
      }
      else {
         resp.writeHead(404);
         resp.end();
      }
   });
   
   server.listen(8080);
}


run();
