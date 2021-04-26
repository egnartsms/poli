const loadModules = require('./load-modules');
const {LOADER_MODULE, RUN_MODULE} = require('./const');


function run(rawModules) {
   let modules = loadModules(rawModules);
   
   let Mloader = modules.find(m => m.name === LOADER_MODULE);
   Mloader.ns['main'](modules);
   
   // let xsTest = modules.find(m => m.name === 'xs-test');
   // xsTest.ns['testTrie']();
   // return;

   // console.log(Mloader.ns['Rmodules']);

   window.exp = modules.find(m => m.name === 'exp').ns;

   let Mrun = modules.find(m => m.name === RUN_MODULE);

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
}


function makeWebsocket() {
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


run(/*RAW_MODULES*/);
