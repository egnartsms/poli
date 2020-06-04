/// ./poli/**/*.js --> SQLite
const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = 'poli.image';
const SCHEMA_PATH = 'schema.sql';
const SRC_FOLDER = 'poli';


function makeEmptyImage() {
   try {
      fs.unlinkSync(IMAGE_PATH);   
   }
   catch (e) {
      if (e.code === 'ENOENT'); else throw e;
   }

   let db = new Database(IMAGE_PATH, {
      verbose: console.log
   });

   db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

   return db;
}


function* poliModuleNamesDefs(moduleName) {
   const re = /^(.+?)\s*::=/gm;

   let str = fs.readFileSync(`./${SRC_FOLDER}/${moduleName}.poli.js`, 'utf8');
   let prev_i = null, prev_name = null;

   for (let {0: whole, 1: name, index} of str.matchAll(re)) {
      if (prev_name !== null) {
         yield [prev_name, str.slice(prev_i, index).trim()];
      }
      prev_i = index + whole.length;
      prev_name = name;
   }

   if (prev_name !== null) {
      yield [prev_name, str.slice(prev_i).trim()];
   }
}


function main() {
   let db = makeEmptyImage();

   let {lastInsertRowid: moduleId} = db
      .prepare(`insert into module(name) values (?)`)
      .run('main');

   let stmt = db.prepare(
      `insert into entry(module_id, name, def, prev_id)
       values (:module_id, :name, :def, :prev_id)`
   );

   db.transaction(() => {
      let prevId = null;

      for (let [name, src] of poliModuleNamesDefs('main')) {
         let def = {
            type: 'native',
            src: src
         };

         ({lastInsertRowid: prevId} = stmt.run({
            module_id: moduleId,
            name: name,
            def: JSON.stringify(def),
            prev_id: prevId
         }));
      }
   })();

   db.close();
}


if (require.main === module) {
   main();
}
