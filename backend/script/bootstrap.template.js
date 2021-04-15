const loadModules = require('./load-modules');
const {RUN_MODULE} = require('./const');


function run(rawModules) {
   let modules = loadModules(rawModules);
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';

   let websocket = new WebSocket(url);
   
   modules.find(m => m.name === 'load').$['main'](modules);
   
   console.log(modules.find(m => m.name === 'load').$['modules']);

   return;

   // That's our protocol with RUN_MODULE:
   //   * we give it the way to send a message over the wire
   //   * it gives us operation handler which we call on incoming operation request
   let handleOperation = name2module[RUN_MODULE].rtobj['main'](
      message => websocket.send(JSON.stringify(message))
   );

   websocket.addEventListener('message', ev => {
      handleOperation(JSON.parse(ev.data));
   });
}


run(/*RAW_MODULES*/);
