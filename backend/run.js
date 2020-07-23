const Database = require('better-sqlite3');

const {
   IMAGE_PATH,
   BOOTSTRAP_MODULE,
   RUN_MODULE,
   SRC_FOLDER,
} = require('./common');


function loadImage() {
   function moduleEval(code) {
      let fun = new Function('$_, $', `return (${code})`);
      return fun.call(null, $_, $);
   }

   let db = new Database(IMAGE_PATH, {
      verbose: console.log
   });
   let $_ = {
      BOOTSTRAP_MODULE,
      SRC_FOLDER,
      require,
      db,
   };
   let $ = Object.create(null);

   let entries = db
      .prepare(`
         SELECT name, def
         FROM entry
         WHERE module_name = :bootstrap_module
      `)
      .all({
         bootstrap_module: BOOTSTRAP_MODULE
      });

   for (let {name, def} of entries) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $[name] = moduleEval(def.src);
   }

   return $['main']();
}


function main() {
   let modules = loadImage();
   let run = modules.find(m => m.name === RUN_MODULE);
   run.rtobj['main']();
}


if (require.main === module) {
   main();
}


exports.loadImage = loadImage;
