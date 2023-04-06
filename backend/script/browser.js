import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert';
import { WebSocketServer } from 'ws';
import mime from 'mime-lite';
import * as chokidar from 'chokidar';

import {npmExports} from './importmap.js';


const BASE_DIR = new URL('../', import.meta.url).pathname;
const NODE_MODULES = path.join(BASE_DIR, 'node_modules');


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
      let srv;

      if (req.url === '/ws/frontend') {
        srv = front;
      }
      else if (req.url === '/ws/backend') {
        srv = back;
      }
      else {
        console.error(`Unexpected WS request pathname: ${req.url}`);
        socket.destroy();
        return;
      }

      srv.handleUpgrade(req, socket, head);
    })
    .on('request', handleRequest)
    .listen(8080);

  chokidar
    .watch(path.join(BASE_DIR, 'sample'))
    .on('change', (filepath) => {
      console.log("File changed:", filepath);
      back.send("changed");
    });
}


/**
 * All registered projects. Each project is essentially a filesystem subtree.
 * There may be multiple ones loaded into a webpage at the same time, and all
 * of them may be manageable through Poli.sys, independently.
 * 
 * PROJECT_NAME -> rootDir
 * 
 * Project name is a random word used to identify a project. It's used in URLs.
 */
const projectRegistry = new Map([['sample', path.resolve('./sample')]]);


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

  if ((mo = /^\/proj\/(.+?)\/(.*)$/.exec(req.url)) !== null) {
    let [, projName, modulePath] = mo;

    if (!projectRegistry.has(projName)) {
      sendData(resp, 400, {"message": "Unknown project"});
      return;
    }

    let projRoot = projectRegistry.get(projName);

    if (modulePath) {
      sendFile(resp, path.join(projRoot, modulePath + '.js'));
    }
    else {
      sendProjectMetadata(resp, projRoot);
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


function sendProjectMetadata(resp, projRoot) {
  let rootModule;

  try {
    let config = JSON.parse(
      fs.readFileSync(path.join(projRoot, '.poli.json'), 'utf8')
    );
    rootModule = config["rootModule"];
  }
  catch (e) {
    sendData(resp, 400, {"message": ".poli.json not operable"})
    return;
  }

  if (typeof rootModule !== 'string') {
    sendData(resp, 400, {"message": "Root module not specified"});
    return;
  }

  sendData(resp, 200, {
    "rootModule": rootModule
  });
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


run();
