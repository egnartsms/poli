import {procedure, entity, runToFixpoint} from '$/reactive';


let student = entity();


procedure("Initialize the student", () => {
   student.name = "Joe";
   student.age = 22;
});


procedure("Report the student", () => {
   console.log(`Student ${student.name} is ${student.age} years old`);
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
