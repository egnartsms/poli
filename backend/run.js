const Database = require('better-sqlite3');

const {
   IMAGE_PATH,
   BOOTSTRAP_MODULE,
   RUN_MODULE,
   SRC_FOLDER,
   LOBBY_OID
} = require('./common');


function loadImage() {
   function moduleEval(code) {
      let fun = new Function('$_, $', `return (${code})`);
      return fun.call(null, $_, $);
   }

   let db = new Database(IMAGE_PATH, {
      verbose: null, // console.log
   });
   let $_ = {
      db,
      require,
      BOOTSTRAP_MODULE,
      SRC_FOLDER,
      LOBBY_OID,
   };
   let $ = Object.create(null);

   let bootstrapEntries = db
      .prepare('SELECT entry, src FROM bootstrap_entries')
      .all();

   for (let {entry, src} of bootstrapEntries) {
      $[entry] = moduleEval(src);
   }

   console.time('Load image');
   let modules = $['loadImage']();
   console.timeEnd('Load image');
   return modules;
}


function main() {
   let modules = loadImage();
   modules[RUN_MODULE].rtobj['main']();
}


if (require.main === module) {
   main();
}


exports.loadImage = loadImage;
