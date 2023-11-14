export {parseTopLevel};


const rBlankLine = `\\s*?\n`;
const rIndentedLine = `[ \t]+\\S.*\n`;
const rZeroLine = `(?!(?://|/\\*))\\S.*\n`;
const rCodeTerminatingLine = `[)\\]}\`'"].*\n`;
const rCode = (
   `^${rZeroLine}` + 
   `(?:(?:${rBlankLine})*${rIndentedLine})*` +
   `(?:(?:${rBlankLine})*${rCodeTerminatingLine})?`
);


const reBlock = new RegExp(rCode, 'gm');


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
