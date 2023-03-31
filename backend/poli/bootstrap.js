import {loadProject} from '$/poli/load.js';


async function loadPoli() {
  let rootModule = await loadProject('poli');

  
}


console.time('bootstrap');
loadPoli().finally(() => console.timeEnd('bootstrap'));
