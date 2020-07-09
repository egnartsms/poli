/**
  Make an SQLite database (image) from module files under ./poli
*/

const fs = require('fs');
const Database = require('better-sqlite3');
const util = require('util');
const {matchAllHeaderBodyPairs} = require('./common');

const IMAGE_PATH = 'poli.image';
const SCHEMA_PATH = 'schema.sql';
const SRC_FOLDER = 'poli';


function parseModule(str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = parseImports(rawImports);
   let body = parseBody(rawBody);

   return {imports, body};
}


function parseImports(str) {
   let res = [];

   for (let [[,donor], rawImports] of matchAllHeaderBodyPairs(str, /^(\S.*?)\s*\n/gm)) {
      let imports = Array.from(
         rawImports.matchAll(/^\s+(?<entry>.*?)(?:\s+(as)\s+(?<alias>.+?))?\s*$/gm)
      );

      if (imports.length === 0) {
         // This should not normally happen but not an error
         continue;
      }

      let asterisk = null;

      if (imports[0].groups.entry === '*') {
         asterisk = imports[0].groups.alias;
         imports.splice(0, 1);
      }

      res.push({
         donor,
         asterisk,
         imports: Array.from(imports, imp => ({
            entry: imp.groups.entry,
            alias: imp.groups.alias || null,
         }))
      });
   }

   return res;
}


function parseBody(str) {
   const re = /^(\S+?)\s*::=/gm;

   return Array.from(
      matchAllHeaderBodyPairs(str, re),
      ([mtch, def]) => [mtch[1], def.trim()]
   );
}


function moduleNameByFile(moduleFile) {
   let mtch = /^(?<module_name>.+?)\.poli\.js$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return mtch.groups.module_name;
}


function allModuleFiles() {
   // bootloader.poli.js should always go first
   let files = fs.readdirSync(SRC_FOLDER);

   files.splice(files.indexOf('bootloader.poli.js'), 1);
   files.unshift('bootloader.poli.js');
   return files;
}


function makeImage(db) {
   let modules = Object.create(null);

   let stmtInsertModule = db.prepare(
      `INSERT INTO module(name) VALUES (:name)`
   );
  
   for (let moduleFile of allModuleFiles()) {
      let moduleName = moduleNameByFile(moduleFile);
      if (moduleName === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }

      let {lastInsertRowid: moduleId} = stmtInsertModule.run({name: moduleName});

      let contents = fs.readFileSync(`./${SRC_FOLDER}/${moduleFile}`, 'utf8');
      let module = parseModule(contents);

      modules[moduleName] = {
         id: moduleId,
         name: moduleName,
         imports: module.imports,
         body: module.body,
         entry2id: Object.create(null)
      };
   }

   // Insert module bodies
   let stmtInsertEntry = db.prepare(
      `INSERT INTO entry(module_id, name, def, prev_id) VALUES
       (:module_id, :name, :def, :prev_id)`
   );

   for (let module of Object.values(modules)) {
      let prevId = null;

      for (let [name, src] of module.body) {
         let def = {
            type: 'native',
            src: src
         };

         ({lastInsertRowid: prevId} = stmtInsertEntry.run({
            module_id: module.id,
            name: name,
            def: JSON.stringify(def),
            prev_id: prevId
         }));

         module.entry2id[name] = prevId;
      }
   }

   // Insert imports
   let stmtInsertImport = db.prepare(
      `INSERT INTO import(recp_module_id, donor_entry_id, alias) VALUES
       (:recp_module_id, :donor_entry_id, :alias)`
   );
   let stmtInsertStarImport = db.prepare(
      `INSERT INTO star_import(recp_module_id, donor_module_id, alias) VALUES
       (:recp_module_id, :donor_module_id, :alias)`
   );

   for (let recpModule of Object.values(modules)) {
      for (let {donor, asterisk, imports} of recpModule.imports) {
         let donorModule = modules[donor];
         if (donorModule == null) {
            throw new Error(`Module ${recpModule.name}: cannot import module ${donor}`);
         }

         if (asterisk) {
            stmtInsertStarImport.run({
               recp_module_id: recpModule.id,
               donor_module_id: donorModule.id,
               alias: asterisk,
            });
         }

         for (let {entry, alias} of imports) {
            let entryId = donorModule.entry2id[entry];
            if (entryId == null) {
               throw new Error(
                  `Module ${recpModule.name}: cannot import ${entry} from module ${donor}`
               );
            }

            stmtInsertImport.run({
               recp_module_id: recpModule.id,
               donor_entry_id: entryId,
               alias: alias,
            });
         }
      }
   }
}


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
   db.transaction(makeImage)(db);
   db.close();
}


if (require.main === module) {
   main();
}
