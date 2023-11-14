import { procedure, entity, runToFixpoint, externalEventHandler } from '$/reactive';


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
   loadModuleContents('sample', 'main').then((textContents) => {
      this.augment(() => {
         sampleModule.textContents = textContents;
      });
   });

   externalEventHandler(ws, 'message', async (event) => {
      let textContents = await loadModuleContents('sample', 'main');

      this.augment(() => {
         sampleModule.textContents = textContents;
      });
   });
});


procedure("Report sample module contents length, in chars", function () {
   console.log("Sample module contents length=", sampleModule.textContents.length);
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
