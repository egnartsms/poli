import {loadProject} from '$/poli/load.js';


async function loadPoli() {
  let rootModule = await loadProject('sample');

  
}


console.time('bootstrap');
loadPoli().finally(() => console.timeEnd('bootstrap'));
