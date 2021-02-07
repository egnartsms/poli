const Database = require('better-sqlite3');


function makeDb(image) {
   let db = new Database(image, {
      verbose: null, // console.log
   });

   db.pragma('journal_mode = wal');

   return db;
}


Object.assign(exports, {
   IMAGE_PATH: 'poli.image',
   SCHEMA_PATH: 'schema.sql',
   SRC_FOLDER: 'poli',
   IMG2FS_MODULE: 'img2fs',
   BOOTSTRAP_MODULE: 'bootstrap',
   RUN_MODULE: 'run',
   LOBBY_OID: 0,

   makeDb
});
