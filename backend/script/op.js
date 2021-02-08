/**
  Make an SQLite database (image) from module files under ./poli
*/

const fs = require('fs');
const assert = require('assert').strict;
const Database = require('better-sqlite3');


const
   IMAGE_PATH = 'poli.image',
   SCHEMA_PATH = 'schema.sql',
   SRC_FOLDER = 'poli',
   IMG2FS_MODULE = 'img2fs',
   BOOTSTRAP_MODULE = 'bootstrap',
   RUN_MODULE = 'run',
   LOBBY_OID = 0;


function recreateImage() {
   let db = createEmptyImage();

   try {
      db.transaction(bootstrapImage)(db);
      db.close();
   }
   catch (e) {
      db.close();
      ensureImageFileUnlinked();
      throw e;
   }
}


function makeDb(image) {
   let db = new Database(image, {
      verbose: null, // console.log
   });

   db.pragma('journal_mode = wal');

   return db;
}


function createEmptyImage() {
   ensureImageFileUnlinked();

   let db = makeDb(IMAGE_PATH);
   db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

   return db;
}


function ensureImageFileUnlinked() {
   try {
      fs.unlinkSync(IMAGE_PATH);   
   }
   catch (e) {
      if (e.code === 'ENOENT'); else throw e;
   }   
}


function bootstrapImage(db) {
   let $_ = {
      require,
      db,
      matchAllHeaderBodyPairs,
      parseBody,
      SRC_FOLDER,
      LOBBY_OID,
      BOOTSTRAP_MODULE
   };

   let $ = Object.create(null);

   function moduleEval(code) {
      let fun = new Function('$_, $', `return (${code})`);
      return fun.call(null, $_, $);
   }

   let contents = fs.readFileSync(`./${SRC_FOLDER}/${BOOTSTRAP_MODULE}.js`, 'utf8');
   let entries = parseBody(contents);

   for (let [name, code] of entries) {
      $[name] = moduleEval(code);
   }

   $['makeImageByFs']();
}


function parseBody(str) {
   const re = /^(\S+?) ::=(?=\s)/gm;

   return Array.from(matchAllHeaderBodyPairs(str, re), ([mtch, def]) => [mtch[1], def]);
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.
*/
function* matchAllHeaderBodyPairs(str, reHeader) {
   assert(reHeader.global);

   let prev_i = null, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (prev_mtch !== null) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }
      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}


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


function runImage() {
   let db = makeDb(IMAGE_PATH);
   let modules = loadImage(db);
   
   modules[RUN_MODULE].rtobj['main']();

   process.on('SIGINT', () => {
      db.close();
      process.exit(2);
   });
}


function dumpImage() {
   let db = makeDb(IMAGE_PATH);

   try {
      let modules = loadImage(db);
      let img2fs = modules[IMG2FS_MODULE];

      fs.rmdirSync(SRC_FOLDER, {recursive: true});
      fs.mkdirSync(SRC_FOLDER, {mode: '775'});

      img2fs.rtobj['main']();
   }
   finally {
      db.close();
   }
}


Object.assign(exports, {
   recreateImage,
   loadImage,
   runImage,
   dumpImage
});
