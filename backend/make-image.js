/// ./poli/**/*.js --> SQLite
const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = 'poli.image';
const SCHEMA_PATH = 'schema.sql';


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


function main() {
   let db = makeEmptyImage();
   let poli = require('./poli/main');

   let {lastInsertRowid: moduleId} = db
      .prepare(`insert into module(name) values (?)`)
      .run('main');

   let stmt = db.prepare(`insert into entry(module_id, name, def) values (?, ?, ?)`);

   db.transaction(() => {
      for (let [key, src] of Object.entries(poli)) {
         let def = {
            type: 'native',
            src: src
         };
         stmt.run(moduleId, key, JSON.stringify(def));
      }
   })();

   db.close();
}


if (require.main === module) {
   main();
}
