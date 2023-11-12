import {procedure, entity, runToFixpoint} from '$/reactive';


let student = entity();


procedure("Report the student", () => {
   console.log("Attempt");
   console.log(`Student ${student.name} is a ${student.role}`);
});


procedure("Initialize the student", () => {
   student.name = "Joe";
   student.age = 24;
});


procedure("Set the role", () => {
   if (student.sex === 'male') {
      student.role = student.age >= 25 ? 'man' : 'boy';
   }
   else if (student.sex === 'female') {
      student.role = student.age >= 22 ? 'woman' : 'girl';
   }
});


procedure("Set sex", () => {
   student.sex = 'male';
});


runToFixpoint();



// import {loadModuleContents} from '$/poli/project.js';
// import {makeEntity, runToFixPoint} from '$/reactive';


// export let testModule;


// async function loadSample() {
//    let ws = makeWebsocket();
//    testModule = makeEntity();

//    async function reloadTestModule() {
//       let contents = await loadModuleContents('sample', 'main');
//       testModule.contents = contents;

//       runToFixPoint();
//    }

//    ws.addEventListener('message', reloadTestModule);

//    reloadTestModule();
// }


// function makeWebsocket() {
//    let url = new URL('/ws/backend', window.location.href);
//    url.protocol = 'ws';
//    return new WebSocket(url);
// }


// loadSample().finally(() => console.log("Sample loaded"));
