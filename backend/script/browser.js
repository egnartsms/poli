import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import mime from 'mime-lite';

import { SRC_FOLDER, RUN_MODULE } from '$/poli/const.js';


const GEN_ROOT = new URL('../gen/', import.meta.url).pathname;


let projects = new Map;


async function addProjectRoot(root) {
  let rootFolder = new URL(root, import.meta.url).pathname;
  let config = JSON.parse(
    await fsP.readFile(path.join(rootFolder, 'poli.json'))
  );

  if (typeof config['project-name'] !== 'string' ||
      typeof config['root-module'] !== 'string') {
    throw new Error(`Malformed poli.json config for root folder '${folder}'`);
  }

  if (projects.has(config['project-name'])) {
    throw new Error(`Double project name: '${config['project-name']}'`);
  }

  projects.set(config['project-name'], {
    rootFolder: rootFolder,
    rootModule: config['root-module'],
  });

  // TODO: add check for project folder structure overlap ?
}


function run() {
  let wsBack = null;
  let wsFront = null;

  const prepareFrontendWebsocket = (ws) =>
    ws
    .on('close', function(code, reason) {
      wsFront = null;
      console.log(
        "Frontend disconnected. Code:", code, "reason:", reason.toString()
      );
    })
    .on('error', function(error) {
      console.error("Frontend websocket connection error:", error);
    })
    .on('message', (data) => {
      if (wsBack !== null) {
        console.log('front -> back');
        wsBack.send(data);
      }
      else {
        console.log('front -> (no)');
        // This needs to be kept in-sync with our messaging format, which is
        // bad
        // TODO: change this
        wsFront.send(JSON.stringify({
          type: 'resp',
          success: false,
          error: 'not-connected',
          info: {
            message: "The browser is not connected"
          }
        }));
      }
    });

  let wssFrontend = new WebSocketServer({ noServer: true })
    .on('error', function (error) {
      console.error("Frontend websocket server error:", error);
    })
    .on('connection', function (ws) {
      if (wsFront !== null) {
        console.error(
          "Double simultaneous connections from frontend attempted"
        );
        ws.close();

        return;
      }

      wsFront = ws;
      prepareFrontendWebsocket(wsFront);

      console.log("Frontend connected");
    });

  const prepareBackendWebsocket = (ws) =>
    ws
    .on('close', function (code, reason) {
      wsBack = null;
      console.log(
        "Backend disconnected. Code:", code, "reason:", reason.toString()
      );
    })
    .on('error', function(error) {
      console.error("Backend websocket connection error:", error);
    })
    .on('message', (data) => {
      if (wsFront !== null) {
        console.log('back -> front');
        wsFront.send(data);
      }
      else {
        console.log('back -> (no)');
      }
    });

  let wssBackend = new WebSocketServer({ noServer: true })
    .on('error', function(error) {
      console.error("Backend websocket server error:", error);
    })
    .on('connection', function(ws) {
      if (wsBack !== null) {
        console.error(
          "Double simultaneous connections from backend attempted");
        ws.close();
        return;
      }

      wsBack = ws;
      prepareBackendWebsocket(wsBack);

      console.log("Backend connected");
    });

  http.createServer()
    .on('upgrade', (req, socket, head) => {
      const url = new URL(req.url);

      let wss;

      if (url.pathname === '/ws/frontend') {
        wss = wssFrontend;
      }
      else if (url.pathname === '/ws/backend') {
        wss = wssBackend;
      }
      else {
        console.error(`Unexpected WS request pathname: ${url.pathname}`);
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws, req) => {
        wss.emit('connection', ws, req);
      });
    })
    .on('request', (req, resp) => {
      if (req.url === '/') {
        sendFile(resp, 'index.html');
        return;
      }

      let mo;

      if ((mo = /^\/gen\/(.*)$/.exec(req.url)) !== null) {
        let [, file] = mo;

        sendFile(resp, path.join(GEN_ROOT, file));

        return;
      }

      if ((mo = /^\/proj\/([^/]+)\/(.*)$/.exec(req.url)) !== null) {
        let [, projName, modulePath] = mo;

        if (projects.has(projName)) {
          let proj = projects.get(projName);

          if (modulePath) {
            sendFile(resp, path.join(proj.rootFolder, modulePath + '.js'));
          }
          else {
            sendData(resp, 200, {
              rootModule: proj.rootModule
            });
          }
        }
        else {
          sendData(resp, 404, {
            result: false,
            error: `Unknown project '${projName}'`
          });
        }

        return;
      }

      resp.writeHead(404).end();
    })
    .listen(8080);
}


function sendFile(resp, filePath) {
  try {
    fs.accessSync(filePath);
  }
  catch (e) {
    resp.writeHead(404).end();
    return;
  }

  resp.writeHead(200, {
    'Content-Type': mime.getType(filePath)
  });

  fs.createReadStream(filePath).pipe(resp);
}


function sendData(resp, code, data) {
  resp
    .writeHead(code, {
      'Content-Type': 'application/json'
    })
    .end(JSON.stringify(data));
}


addProjectRoot('../poli/');


run();
