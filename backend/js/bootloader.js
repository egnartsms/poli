// const loadModules = require('./load-modules');
import {WORLD_MODULE, RUN_MODULE} from './const';
import {loadModulesData} from './load';
import {parseRawModule} from './parse';


function run(rawModules) {
   console.time('mini');
   let modulesData = Array.from(rawModules, parseRawModule);
   let namespaces = loadModulesData(modulesData);
   console.timeEnd('mini');

   console.log(namespaces);
   return;

   // Tests
   {
      let mTest = minfos.find(m => m.name === 'test-dedb');
      mTest.ns['runTests']();
   }

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


run(/*RAW_MODULES*/);
