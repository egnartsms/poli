/**
  Make an SQLite database (image) from module files under ./poli
*/

const fs = require('fs');
const Database = require('better-sqlite3');
const util = require('util');
const assert = require('assert').strict;

const {
   IMAGE_PATH,
   SCHEMA_PATH,
   SRC_FOLDER,
   LOBBY_OID,
   BOOTSTRAP_MODULE
} = require('./common');


/**
 * Parse any kind of text separated with headers into header/body pairs:
      HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header of the end of string is considered
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


function parseBody(str) {
   const re = /^(\S+?)\s*::=/gm;

   return Array.from(
      matchAllHeaderBodyPairs(str, re),
      ([mtch, def]) => [mtch[1], def.trim()]
   );
}


function makeImage(db) {
   let contents = fs.readFileSync(`./${SRC_FOLDER}/bootstrap.poli.js`, 'utf8');
   let entries = parseBody(contents);

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

   for (let [name, code] of entries) {
      $[name] = moduleEval(code);
   }

   db.transaction($['makeImageByFs'])();
}


function makeEmptyImage() {
   ensureImageFileUnlinked();

   let db = new Database(IMAGE_PATH, {
      verbose: console.log
   });

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


function main() {
   let db = makeEmptyImage();

   try {
      db.transaction(makeImage)(db);
      db.close();
   }
   catch (e) {
      db.close();
      ensureImageFileUnlinked();
      throw e;
   }
}


if (require.main === module) {
   main();
}
