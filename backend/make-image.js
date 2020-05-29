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


function* poliModuleKeyVals(moduleName) {
   const re = /^(?<key>[^\n]+?)\s*::=\s*(?<val>.+?)\s*(?=^[^\n]+?::=)/gms;

   let str = fs.readFileSync(`./${SRC_FOLDER}/${moduleName}.poli.js`, 'utf8');

   for (let {groups: {key, val}} of str.matchAll(re)) {
      yield [key, val];
   }
}


function main() {
   let db = makeEmptyImage();

   let {lastInsertRowid: moduleId} = db
      .prepare(`insert into module(name) values (?)`)
      .run('main');

   let stmt = db.prepare(`insert into entry(module_id, key, def) values (?, ?, ?)`);

   db.transaction(() => {
      for (let [key, val] of poliModuleKeyVals('main')) {
         let def = {
            type: 'native',
            src: val
         };
         stmt.run(moduleId, key, JSON.stringify(def));
      }
   })();

   db.close();
}


if (require.main === module) {
   main();
}
