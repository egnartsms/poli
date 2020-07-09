const fs = require('fs');
const Database = require('better-sqlite3');
const {
   orderModuleEntries, BOOTLOADER_MODULE_ID
} = require('./common');


const IMAGE_PATH = 'poli.image';


function main() {
   function moduleEval(code) {
      let fun = new Function('$_, $', `return (${code})`);
      return fun.call(null, $_, $);
   }

   let db = new Database(IMAGE_PATH, {verbose: console.log});
   let $_ = makeBuiltinsObject(db);
   let $ = Object.create(null);

   let entries = db
      .prepare(`SELECT name, def FROM entry WHERE module_id = :bootloader_module_id`)
      .all({
         'bootloader_module_id': BOOTLOADER_MODULE_ID
      });

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $[name] = moduleEval(def.src);
   }

   $._init();
}


function makeBuiltinsObject(db) {
   return Object.assign(Object.create(null), {
      BOOTLOADER_MODULE_ID,
      require,
      db,
      orderModuleEntries
   });
}


if (require.main === module) {
   main();
}
