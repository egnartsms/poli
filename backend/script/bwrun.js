const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const url = require('url');


const {SRC_FOLDER, RUN_MODULE} = require('./const');
const {loadPoli} = require('./load');
const {readRawModules} = require('./raw');


function run() {
   let server = http.createServer();
   let wssBrowser = new WebSocket.Server({ noServer: true });
   let wssSublime = new WebSocket.Server({ noServer: true });

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
               console.log("Sublime disconnected. Code:", code, "reason:", reason);
            })
            .on('error', function (error) {
               console.error("Sublime websocket connection error:", error);
            })
            .on('message', (data) => {
               if (wsBrowser !== null) {
                  console.log('sublime -> browser: ', data);
                  wsBrowser.send(data);
               }
               else {
                  console.log('sublime -> 0', data);
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
                  console.log("Browser disconnected. Code:", code, "reason:", reason);
               })
               .on('error', function (error) {
                  console.error("Browser websocket connection error:", error);
               })
               .on('message', (data) => {
                  if (wsSublime !== null) {
                     console.log('browser -> sublime: ', data);
                     wsSublime.send(data);
                  }
                  else {
                     console.log('browser -> 0', data);
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
      else if (pathname === '/bootstrap.js') {
         let rawModules = readRawModules();
         let bootstrap = fs
            .readFileSync('./script/bootstrap.js', 'utf8')
            .replace(/"%RAW_MODULES%"/, () => JSON.stringify(rawModules, null, 2));

         resp.writeHead(200, {
            'content-type': 'text/javascript'
         });
         resp.end(bootstrap);
      }
      else {
         resp.writeHead(404);
         resp.end();
      }
   });
   
   server.listen(8080);
}


if (require.main === module) {
   run();
}
