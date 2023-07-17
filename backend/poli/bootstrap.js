import {loadProject, refreshModule} from '$/poli/load.js';


async function loadSample() {
  let rootModule = await loadProject('sample');
  let ws = makeWebsocket();

  ws.addEventListener('message', ev => {
    console.log("Module refresh!", ev);
    refreshModule(rootModule);
  });
}


function makeWebsocket() {
  let url = new URL('/ws/backend', window.location.href);
  url.protocol = 'ws';
  return new WebSocket(url);
}


function initialLoad() {
  console.time('sample');
  loadSample().finally(() => console.timeEnd('sample'));
}


initialLoad();
