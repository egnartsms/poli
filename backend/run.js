const fs = require('fs');
const Database = require('better-sqlite3');
const {orderByPrecedence} = require('./common');


const IMAGE_PATH = 'poli.image';


function loadModule(moduleId) {
   let $m = {
      id: moduleId,
      imports: Object.create(null),
      names: [],
      defs: Object.create(null),
   };

   let body = orderByPrecedence(
      $_.db.prepare(
         `SELECT id, prev_id, name, def
          FROM entry
          WHERE module_id = ?`
      ).all(moduleId),
      'id', 'prev_id'
   );

   for (let {name, def} of body) {
      def = JSON.parse(def);
      if (def.type !== 'native') {
         throw new Error(`Unrecognized entry type: ${def.type}`);
      }

      $m.names.push(name);
      $m.defs[name] = def;
   }

   let $ = Object.create(null);

   for (let name of $m.names) {
      $[name] = moduleEval($m, $, $m.defs[name].src);
   }

   return {$, $m};
}


function resolveImports(modules) {
   let imports = $_.db.prepare(
      `SELECT *
       FROM import
         INNER JOIN 
       WHERE recp_module_id = ?`
   ).all(moduleId);

}


function main() {
   $_.db = new Database(IMAGE_PATH, {verbose: console.log});

   let {$, $m} = loadModule(2);

   $._init();

   console.log("main module loaded and initialized");
}


const $_ = {
   require,
   moduleEval,
   // the following are filled elsewhere
   db: null,
   modules: Object.create(null)
};


function moduleEval($m, $, code) {
   let fun = new Function('$_, $m, $', `return (${code})`);
   return fun.call(null, $_, $m, $);
}


if (require.main === module) {
   main();
}
