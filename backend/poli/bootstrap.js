import * as rv from '$/reactive';

import * as M from './module.js';
import { theModule } from './sample-module.js';
import './parse.js';
import './compile.js';


export async function loadModuleContents(projName, modulePath) {
   let resp = await fetch(`/proj/${projName}/${modulePath}`);

   if (!resp.ok) {
      throw new Error(`Could not load module contents: '${modulePath}'`);
   }

   return await resp.text();
}


function makeWebsocket() {
   let url = new URL('/ws/backend', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


let ws = makeWebsocket();


rv.procedure("Initial load & subscribe to change notifications", function () {
   M.init(theModule);

   let refresh = () => {
      loadModuleContents('sample', 'main').then((textContents) => {
         this.augment(() => {
            theModule.textContents = textContents;
         });
      });
   };

   rv.externalEventHandler(ws, 'message', refresh);

   refresh();
});


rv.fulfillToFixpoint();
