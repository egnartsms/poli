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
      verbose: console.log
   });
   let $_ = {
      db,
      require,
      BOOTSTRAP_MODULE,
      SRC_FOLDER,
      LOBBY_OID,
   };
   let $ = Object.create(null);

   let entries = db
      .prepare(`
         SELECT jj.key, json_extract(obj.val, '$.src')
         FROM json_each((
            SELECT val
            FROM obj
            WHERE id = (
               SELECT json_extract(val, '$.bootstrapDefs.__ref')
               FROM obj
               WHERE id = :lobby_oid
            )
         )) AS jj JOIN obj ON json_extract(jj.value, '$.__ref') = obj.id;
      `)
      .raw()
      .all({lobby_oid: LOBBY_OID});

   for (let [name, src] of entries) {
      $[name] = moduleEval(src);
   }

   return $['loadImage']();
}


function main() {
   let modules = loadImage();
   modules[RUN_MODULE].rtobj['main']();
}


if (require.main === module) {
   main();
}


exports.loadImage = loadImage;
