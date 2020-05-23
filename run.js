const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = 'poli.image';
const SCHEMA_PATH = 'schema.sql';


function main() {
   let db = new Database(IMAGE_PATH, {});
   let entries =  db.prepare(`select name, def from entry`).all();

   let $ = new Object();

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'fn/js') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $[name] = moduleEval(def.src, $);
   }

   return $;
}


function moduleEval(def, $) {
   let src = `return (${def});`;
   let fun = new Function('$', src);
   return fun.call(null, $);
}


if (require.main === module) {
   $ = main();
   $.sayhi();
}
