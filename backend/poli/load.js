import {parseModuleSource} from '$/poli/parse.js';


function loadProject(projName) {
  
}


function load() {
  let module = rawModules.find(({name}) => name === 'dedb-join-plan');
  parseModuleSource(module.contents);
  return;
}

