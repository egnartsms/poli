import {procedure, entity, runToFixpoint, addEventListener} from '$/reactive';


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


procedure("Subscribe to sample module contents changes", () => {
   addEventListener(ws, 'message', (event) => {
      sampleModule.textContents = event.data;
   });

   console.log("Stub=", sampleModule.stub);
});


procedure("Set stub", () => {
   sampleModule.stub = 0;
});


procedure("Report sample module contents length, in chars", () => {
   console.log("Sample module contents length=", sampleModule.textContents.length);
});


runToFixpoint();


// loadSample().finally(() => console.log("Sample loaded"));
