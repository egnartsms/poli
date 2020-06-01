/// SQLite --> ./poli/**/*.js 
const fs = require('fs');
const Database = require('better-sqlite3');


const IMAGE_PATH = "poli.image";
const SRC_FOLDER = "poli";


/**
 *  @param mdl: {id, name}
 */
function dumpModule(db, mdl) {
   let moduleStream = fs.createWriteStream(`${SRC_FOLDER}/${mdl['name']}.poli.js`, {
      mode: '664'
   });

   let stmt = db
      .prepare('select name, def from entry where module_id = ? order by ord asc')
      .bind(mdl['id']);

   writingToStream(moduleStream, function* () {
      for (let {name, def} of stmt.iterate()) {
         let src = JSON.parse(def).src;

         // console.log(typeof src, src);

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

   for (let mdl of modules) {
      console.log("Dumping", mdl);
      dumpModule(db, mdl);
   }
}


if (require.main === module) {
   main();
}