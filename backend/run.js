const Database = require('better-sqlite3');

const {
   IMAGE_PATH,
   BOOTSTRAP_MODULE,
   RUN_MODULE,
   SRC_FOLDER,
   LOBBY_OID,

   makeDb
} = require('./common');


function loadImage(db) {
   function moduleEval(code) {
      let fun = new Function('$_, $', `return (${code})`);
      return fun.call(null, $_, $);
   }

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
   let db = makeDb(IMAGE_PATH);
   let modules = loadImage(db);
   
   modules[RUN_MODULE].rtobj['main']();

   process.on('SIGINT', () => {
      db.close();
      process.exit(2);
   });
}


if (require.main === module) {
   main();
}


exports.loadImage = loadImage;
