import {loadProject} from '$/poli/load.js';


console.time('bootstrap');

loadProject('poli')
  .then(() => {
    console.log("Project 'poli' loaded");
  })
  .finally(() => {
    console.timeEnd('bootstrap');
  });
