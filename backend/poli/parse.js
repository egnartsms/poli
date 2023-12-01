import * as rv from '$/reactive';
import { theModule } from './sample-module.js';
import { makeEntry } from './entry.js';


rv.procedure("Parse module into top-level blocks", function () {
   theModule.topLevelBlocks = parseTopLevel(theModule.textContents);
});


rv.procedure("Create entries", function () {
   theModule.textToEntry = new Map;
   theModule.entries = new Set;

   rv.repeatable("Reconciliate new top-level blocks with existing info", () => {
      console.log("Reconciliation");

      let oldTextToEntry = new Map(theModule.textToEntry);
      let newTextToEntry = new Map;

      for (let block of theModule.topLevelBlocks) {
         let entry = oldTextToEntry.get(block.text);

         if (entry) {
            oldTextToEntry.delete(block.text);
         }
         else {
            entry = makeEntry(block.text);
            theModule.entries.add(entry);
            console.log("Added entry:", entry.source);
         }

         newTextToEntry.set(block.text, entry);
      }

      for (let [text, entry] of oldTextToEntry) {
         theModule.entries.delete(entry);
         console.log("Deleted entry:", entry.source);
      }

      theModule.textToEntry = newTextToEntry;
   });
});


const rBlankLine = `\\s*?\n`;
const rZeroLine = `(?!(?://|/\\*))\\S.*\n`;
const rIndentedLine = `[ \t]+\\S.*\n`;
const rCodeTerminatingLine = `[)\\]}\`'"].*\n`;
const rBlock = (
   `^${rZeroLine}` + 
   `(?:(?:${rBlankLine})*${rIndentedLine})*` +
   `(?:(?:${rBlankLine})*${rCodeTerminatingLine})?`
);


const reBlock = new RegExp(rBlock, 'gm');


function parseTopLevel(src) {
   let blocks = [];

   reBlock.lastIndex = 0;

   for (;;) {
      let mo = reBlock.exec(src);

      if (mo === null) {
         break;
      }

      blocks.push({
         text: mo[0],
         start: mo.index,
         end: mo.index + mo[0].length,
      });
   }

   return blocks;
}
