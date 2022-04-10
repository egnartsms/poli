const loadModules = require('./load-modules');
const {WORLD_MODULE, RUN_MODULE} = require('./const');


function run(rawModules) {
   let minfos = loadModules(rawModules);

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
