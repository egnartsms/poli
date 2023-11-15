import { procedure, entity, runToFixpoint, externalEventHandler } from '$/reactive';
import { parseTopLevel } from './parse-top-level.js';


export async function loadModuleContents(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  return await resp.text();
}


function makeWebsocket() {
   let url = new URL('/ws/backend', window.location.href);
   url.protocol = 'ws';
   return new WebSocket(url);
}


let ws = makeWebsocket();


export let sampleModule = entity();


procedure("Initial load & subscribe to change notifications", function () {
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


procedure("Create entries", function () {
   sampleModule.textToEntry = new Map;
   sampleModule.entries = new Set;

   console.log("Outer");

   procedure("Reconciliate new top-level blocks with existing info", function () {
      console.log("Reconciliation");

      let oldTextToEntry = new Map(sampleModule.textToEntry);
      let newTextToEntry = new Map;

      for (let block of sampleModule.topLevelBlocks) {
         let entry = oldTextToEntry.get(block.text);

         if (entry) {
            oldTextToEntry.delete(block.text);
         }
         else {
            entry = entity();
            sampleModule.entries.add(entry);
            console.log("Added entry:", block.text);
         }

         entry.source = block.text;

         newTextToEntry.set(block.text, entry);
      }

      for (let [text, entry] of oldTextToEntry) {
         sampleModule.entries.delete(entry);
         console.log("Deleted entry:", text);
      }

      sampleModule.textToEntry = newTextToEntry;
   });
});


runToFixpoint();


// loadSample().finally(() => console.log("Sample loaded"));
