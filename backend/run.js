const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = 'poli.image';


function main() {
   let db = new Database(IMAGE_PATH, {});
   let entries = db.prepare(`select name, def from entry`).all();

   let $_ = {
      require,
      keys: Symbol('keys'),
      moduleEval: function (code) {
         return moduleEval($_, $d, $, code);
      }
   };

   let $d = {
      [$_.keys]: []
   };

   let $ = {};

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $d[$_.keys].push(name);
      $d[name] = def;

      $[name] = moduleEval($_, $d, $, def.src);
   }

   console.log("_init(db)");
   $._init(db);
   console.log("done");
}


function moduleEval($_, $d, $, code) {
   let fun = new Function('$_, $d, $', `return (${code})`);
   return fun.call(null, $_, $d, $);
}


if (require.main === module) {
   main();
}
