const loadModules = require('./load-modules');
const {WORLD_MODULE, RUN_MODULE} = require('./const');


function run(rawModules) {
   let minfos = loadModules(rawModules);
   
   // let Mworld = minfos.find(m => m.name === WORLD_MODULE);
   // Mworld.ns['load'](minfos);
   
   let mprolog = minfos.find(m => m.name === 'prolog');
   mprolog.ns['initialize']();
   window.pl = mprolog.ns;

   for (let [name, val] of Object.entries(mprolog.ns)) {
      if (name.startsWith('test_')) {
         val();
      }
   }
   
   return;

   // window.exp = minfos.find(m => m.name === 'exp').ns;

   // let Mrun = minfos.find(m => m.name === RUN_MODULE);

   // // That's our contract with RUN_MODULE:
   // //   * we give it the way to send a message over the wire
   // //   * it gives us operation handler which we call on incoming operation request
   // let websocket = makeWebsocket();

   // let handleMessage = Mrun.ns['main'](
   //    message => websocket.send(JSON.stringify(message))
   // );

   // websocket.addEventListener('message', ev => {
   //    handleMessage(JSON.parse(ev.data));
   // });
}


function makeWebsocket() {
   let url = new URL('/browser', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


run(/*RAW_MODULES*/);
