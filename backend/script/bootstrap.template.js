const loadModules = require('./load-modules');
const {LOAD_MODULE, RUN_MODULE} = require('./const');


function run(rawModules) {
   let modules = loadModules(rawModules);
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';
   let websocket = new WebSocket(url);
   
   let Mload = modules.find(m => m.name === LOAD_MODULE);
   Mload.$['main'](modules);
   
   // let xsTest = modules.find(m => m.name === 'xs-test');
   // xsTest.$['testVector']();
   // return;

   let Mrun = modules.find(m => m.name === RUN_MODULE);

   // That's our contract with RUN_MODULE:
   //   * we give it the way to send a message over the wire
   //   * it gives us operation handler which we call on incoming operation request
   let handleMessage = Mrun.$['main'](
      message => websocket.send(JSON.stringify(message))
   );

   websocket.addEventListener('message', ev => {
      handleMessage(JSON.parse(ev.data));
   });
}


run(/*RAW_MODULES*/);
