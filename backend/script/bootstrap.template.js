const {loadPoli} = require('./load');
const {RUN_MODULE} = require('./const');


function run(rawModules) {
   let modules = loadPoli(rawModules);
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';

   let websocket = new WebSocket(url);
   
   // That's our protocol with RUN_MODULE:
   //   * we give it the way to send a message over the wire
   //   * it gives us operation handler which we call on incoming operation request
   let handleOperation = modules[RUN_MODULE].rtobj['main'](
      message => websocket.send(JSON.stringify(message))
   );

   websocket.addEventListener('message', ev => {
      handleOperation(JSON.parse(ev.data));
   });
}


window.raw_modules = ("%RAW_MODULES%");
run(window.raw_modules);
