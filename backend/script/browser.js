import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import mime from 'mime-lite';

import { SRC_FOLDER, RUN_MODULE } from '$/poli/const.js';
import {npmExports} from './importmap.js';


class ForwardingWsServer {
  side;
  ws = null;
  server;
  sink = null;

  constructor(side) {
    this.side = side;
    this.server = new WebSocketServer({ noServer: true })
      .on('error', this.onError.bind(this))
      .on('connection', this.onConnection.bind(this));
  }

  onError(error) {
    console.error(`${this.side}: websocket server error:`, error);
  }

  onConnection(ws) {
    assert(this.ws === null);

    this.ws = ws;
    this.ws
      .on('close', (code, reason) => {
        this.ws = null;
        console.log(
          `${this.side} disconnected, code: '${code}', reason: ` +
          `'${reason.toString()}'`
        );
      })
      .on('error', (error) => {
        console.error(`${this.side} websocket connection error:`, error);
      })
      .on('message', (data) => this.sink.send(data));

    console.log(`${this.side}: connected`);
  }

  handleUpgrade(req, socket, head) {
    if (this.ws !== null) {
      console.error(`${this.side}: double simultaneous connections attempted`);
      socket.destroy();
      return;
    }

    this.server.handleUpgrade(req, socket, head, (ws, req) => {
      // No race conditions
      if (this.ws !== null) {
        console.error(`${this.side}: double simultaneous connections attempted`);
        ws.close();
        return;
      }

      this.server.emit('connection', ws, req);
    });
  }

  send(data) {
    if (this.ws === null) {
      console.log(`${this.side}: not connected, message ignored`);
      return;
    }

    this.ws.send(data);
  }
}


function mate(srvA, srvB) {
  srvA.sink = srvB;
  srvB.sink = srvA;
}


function run() {
  let front = new ForwardingWsServer('front');
  let back = new ForwardingWsServer('back');

  mate(front, back);

  http.createServer()
    .on('upgrade', (req, socket, head) => {
      const url = new URL(req.url);

      let srv;

      if (url.pathname === '/ws/frontend') {
        srv = front;
      }
      else if (url.pathname === '/ws/backend') {
        srv = back;
      }
      else {
        console.error(`Unexpected WS request pathname: ${url.pathname}`);
        socket.destroy();
        return;
      }

      srv.handleUpgrade(req, socket, head);
    })
    .on('request', handleRequest)
    .listen(8080);
}


const BASE_DIR = new URL('../', import.meta.url).pathname;
const NODE_MODULES = path.join(BASE_DIR, 'node_modules');


function handleRequest(req, resp) {
  console.log(req.method, req.url);

  if (req.url === '/') {
    sendFile(resp, 'index.html');
    return;
  }

  if (req.url === '/importmap') {
    sendImportmapScript(resp);
    return;
  }

  let mo;

  if ((mo = /^\/gen\/(.*)$/.exec(req.url)) !== null) {
    let [, file] = mo;

    sendFile(resp, path.join(BASE_DIR, 'gen', file));
    return;
  }

  if ((mo = /^\/3rdparty\/(.*)$/.exec(req.url)) !== null) {
    let [, file] = mo;

    sendFile(resp, path.join(NODE_MODULES, file));

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
        // Here should go some metadata about the project.
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


const renderImportmapScript = (importmap) => `
  (function () {
    let im = document.createElement('script');

    im.type = 'importmap';
    im.textContent = ${JSON.stringify(JSON.stringify(importmap, null, 4))};

    document.currentScript.after(im);
  })()
`;


async function sendImportmapScript(resp) {
  let importmap;

  try {
    importmap = {
      "imports": await npmExports({
        baseDir: BASE_DIR,
        urlPrefix: '/3rdparty'
      })
    };
  }
  catch (e) {
    resp.writeHead(404).end();
    console.error(`Importmap composition failed:`, e);
    throw e;
  }

  resp.writeHead(200, {'Content-Type': 'text/javascript'})
    .end(renderImportmapScript(importmap));
}


let projects = new Map;


function addProjectRoot(root) {
  let rootFolder = new URL(root, import.meta.url).pathname;
  let config = JSON.parse(fs.readFileSync(path.join(rootFolder, 'poli.json')));

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


function main() {
  addProjectRoot('../poli/');
  run();
}


main();
