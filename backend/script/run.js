const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');


const
   SRC_FOLDER = 'poli',
   BOOTSTRAP_MODULE = 'bootstrap',
   RUN_MODULE = 'run'
;


function run() {
   let modules = load();

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
      wss.handleUpgrade(request, socket, head, function done(ws, request) {
         wss.emit('connection', ws, request);
      });
   });

   // That's our protocol with RUN_MODULE:
   //   * we give it the current websocket getter
   //   * it gives us operation handler
   handleOperation = modules[RUN_MODULE].rtobj['main'](() => websocket);
   
   server.listen(8080);
}


function load() {
   console.time('load');
   let rawModules = readAllModules();

   let $_ = {
      matchAllHeaderBodyPairs,
      parseBody,
      fs,  // in Browser, that won't be available
      BOOTSTRAP_MODULE
   };

   let $ = Object.create(null);

   function moduleEval(code) {
      let fun = Function('$_, $', `"use strict"; return (${code})`);
      return fun.call(null, $_, $);
   }

   let entries = parseBody(rawModules[BOOTSTRAP_MODULE].contents);

   for (let [name, code] of entries) {
      $[name] = moduleEval(code);
   }

   let modules = $['load'](rawModules);
   console.timeEnd('load');
   return modules;
}


function readAllModules() {
   let data = {};

   for (let filename of fs.readdirSync(SRC_FOLDER)) {
      let res = parseModuleFilename(filename);
      if (res === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }

      data[res.name] = {
         type: 'module',
         lang: res.lang,
         name: res.name,
         contents: fs.readFileSync(`./${SRC_FOLDER}/${filename}`, 'utf8')
      };
   }

   return data;
}


function parseModuleFilename(filename) {
   let mtch = /^(?<name>.+)\.(?<lang>js|xs)$/.exec(filename);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}

function parseBody(str) {
   const re = /^(\S+?)\s+::=(?=\s)/gm;
   // Here we parse loosely but still require at least 1 space before and after '::='.
   // (::= can actually be followed immediately by a newline which is a whitespace, too)
   return Array.from(matchAllHeaderBodyPairs(str, re), ([mtch, def]) => [mtch[1], def]);
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.
*/
function* matchAllHeaderBodyPairs(str, reHeader) {
   let prev_i = null, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (prev_mtch !== null) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }
      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}


Object.assign(exports, {load});


if (require.main === module) {
   run();
}
