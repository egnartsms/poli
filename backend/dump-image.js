/// SQLite --> ./poli/**/*.js 
const fs = require('fs');
const Database = require('better-sqlite3');
const {orderByPrecedence} = require('./common');


const IMAGE_PATH = "poli.image";
const SRC_FOLDER = "poli";


function dumpModule(db, moduleId, moduleName) {
   let imports = db.prepare(
      `SELECT
         donor_module.name AS donor_module_name,
         entry.name AS entry,
         import.alias AS alias
       FROM import
         LEFT JOIN entry ON entry.id = import.donor_entry_id
         INNER JOIN module AS donor_module ON donor_module.id = import.donor_module_id
       WHERE import.recp_module_id = ?
       ORDER BY donor_module.name ASC, entry.name ASC`
   )
      .all(moduleId);

   let body = orderByPrecedence(
      db
        .prepare(`SELECT id, prev_id, name, def FROM entry WHERE module_id = ?`)
        .all(moduleId),
      'id', 'prev_id'
   );

   let moduleStream = fs.createWriteStream(`${SRC_FOLDER}/${moduleName}.poli.js`, {
      mode: '664'
   });

   writingToStream(moduleStream, function* () {
      const ind = '   ';

      // Imports
      let curModuleName = null;

      for (let {donor_module_name: moduleName, entry, alias} of imports) {
         if (moduleName !== curModuleName) {
            curModuleName = moduleName;
            yield moduleName;
            yield '\n';
         }

         yield ind;

         if (entry !== null) {
            yield entry;   
         }
         else {
            yield '*';
         }
         
         if (alias) {
            yield ` as ${alias}`;
         }
         yield '\n';
      }

      yield '-----\n';

      // Body
      for (let {name, def} of body) {
         let src = JSON.parse(def).src;

         yield name;
         yield ' ::= ';
         yield src;
         yield '\n';
      }
   });
}


function writingToStream(stream, generatorFunc) {
   for (let piece of generatorFunc()) {
      stream.write(piece);
   }

   stream.end();
}


function main() {
   fs.rmdirSync(SRC_FOLDER, {recursive: true});
   fs.mkdirSync(SRC_FOLDER, {mode: '775'});

   let db = new Database(IMAGE_PATH, {verbose: console.log});
   let modules = db.prepare("select id, name from module").all();

   for (let {id: moduleId, name: moduleName} of modules) {
      dumpModule(db, moduleId, moduleName);
   }
}


if (require.main === module) {
   main();
}