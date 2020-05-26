const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = 'poli.image';


function main() {
   let db = new Database(IMAGE_PATH, {});
   let entries = db.prepare(`select name, def from entry`).all();

   let $ = new Object();

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $[name] = moduleEval(def.src, $);
   }

   return $;
}


function moduleEval(code, $) {
   let fun = new Function('$, require', `return (${code})`);
   
   return fun.call(null, $, require);
}


if (require.main === module) {
   let $ = main();
   $._init();
}
