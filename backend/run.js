const fs = require('fs');
const Database = require('better-sqlite3');
const {orderByPrecedence} = require('./common');


const IMAGE_PATH = 'poli.image';


function main() {
   $_.db = new Database(IMAGE_PATH, {});

   let data = orderByPrecedence(
      $_.db.prepare(`select id, prev_id, name, def from entry`).all(),
      'id', 'prev_id'
   );

   let $m = {
      names: [],
      name2id: Object.create(null),
      defs: Object.create(null),

      // ID of the last name (in the sense of module entry ordering)
      get lastId() {
         if (this.names.length === 0) {
            return null;
         }
         return this.name2id[this.names[this.names.length - 1]];
      },
   };

   for (let {id, name, def} of data) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $m.names.push(name);
      $m.name2id[name] = id;
      $m.defs[name] = def;
   }

   let $ = Object.create(null);

   for (let name of $m.names) {
      $[name] = moduleEval($m, $, $m.defs[name].src);
   }   

   $._init();

   console.log("main module loaded and initialized");
}


const $_ = {
   require,
   moduleEval,
   db: null,  // initialized separately
};


function moduleEval($m, $, code) {
   let fun = new Function('$_, $m, $', `return (${code})`);
   return fun.call(null, $_, $m, $);
}


if (require.main === module) {
   main();
}
