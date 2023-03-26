// const loadModules = require('./load-modules');
import {WORLD_MODULE, RUN_MODULE} from './const.js';
import {loadModulesData} from './load.js';
import {parseRawModule} from './parse.js';
import {parseModuleSource} from './parse-x.js';


function load(rawModules) {
   let module = rawModules.find(({name}) => name === 'engine');
   parseModuleSource(module.contents);
   return;

   console.time('bootload');
   let modulesData = Array.from(rawModules, parseRawModule);
   let namespaces = loadModulesData(modulesData);
   console.timeEnd('bootload');

   // Tests
   {
      namespaces.get('test-dedb')['runTests']();
   }

   return;

   // Load the world
   {
      let Mworld = minfos.find(m => m.name === WORLD_MODULE);
      Mworld.ns['load'](minfos);
   }

   let Mrun = minfos.find(m => m.name === RUN_MODULE);

   // That's our contract with RUN_MODULE:
   //   * we give it the way to send a message over the wire
   //   * it gives us operation handler which we call on incoming operation request
   let websocket = makeWebsocket();

   let handleMessage = Mrun.ns['main'](
      message => websocket.send(JSON.stringify(message))
   );

   websocket.addEventListener('message', ev => {
      handleMessage(JSON.parse(ev.data));
   });

   // Special hack
   {
      let Mexp = minfos.find(m => m.name === 'exp');
      window.exp = Mexp.ns;
   }

   return;
}


function makeWebsocket() {
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


load(/*RAW_MODULES*/);
