import { procedure, entity, runToFixpoint, externalEventHandler } from '$/reactive';
import { parseTopLevel } from './parse-top-level.js';


// let student = entity();


// procedure("Report the student", () => {
//    console.log("Attempt");
//    console.log(`Student ${student.name} is a ${student.role}`);
// });


// procedure("Initialize the student", () => {
//    student.name = "Joe";
//    student.age = 24;
// });


// procedure("Set the role", () => {
//    if (student.sex === 'male') {
//       student.role = student.age >= 25 ? 'man' : 'boy';
//    }
//    else if (student.sex === 'female') {
//       student.role = student.age >= 22 ? 'woman' : 'girl';
//    }
// });


// procedure("Set sex", () => {
//    student.sex = 'male';
// });


// runToFixpoint();



// import {loadModuleContents} from '$/poli/project.js';
// import {makeEntity, runToFixPoint} from '$/reactive';


function makeWebsocket() {
   let url = new URL('/ws/backend', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


let ws = makeWebsocket();


export let sampleModule = entity();


procedure("Initial load", function () {
   let refresh = () => {
      loadModuleContents('sample', 'main').then((textContents) => {
         this.augment(() => {
            sampleModule.textContents = textContents;
         });
      });
   };

   externalEventHandler(ws, 'message', refresh);

   refresh();
});


procedure("Parse module into top-level blocks", function () {
   sampleModule.topLevelBlocks = parseTopLevel(sampleModule.textContents);
});


procedure("Report the top-level blocks", function () {
   console.log("Have top-level blocks:", sampleModule.topLevelBlocks);
});


export async function loadModuleContents(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  return await resp.text();
}


runToFixpoint();


// loadSample().finally(() => console.log("Sample loaded"));
