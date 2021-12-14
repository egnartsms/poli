/**
 * Test performance of some of the SQLite json extension operations.
*/

const fs = require('fs');
const Database = require('better-sqlite3');


const db = new Database('./test.db', {
   verbose: console.log
});


const Nprops = 200;
const Na = 1000;
const Ns = 250;


function makeRandomString(Ns) {
   let codes = new Array(Ns);
   for (let i = 0; i < Ns; i += 1) {
      codes[i] = Math.round(Math.random() * 1000 + 1);
   }

   return String.fromCharCode.apply(null, codes);
}


function makeBigArray(Na, Ns) {
   let ar = new Array(Na);
   for (let i = 0; i < Na; i += 1) {
      ar[i] = makeRandomString(Ns);
   }

   return ar;
}


function createDb() {
   let obj = {};

   for (let i = 0; i < Nprops; i += 1) {
      obj['prop-' + i] = makeBigArray(Na, Ns);
   }

   db.exec(fs.readFileSync('./schema.sql', 'utf8'));

   db.prepare('insert into obj(id, val) values (:id, :val)').run({
      id: 10,
      val: JSON.stringify(obj)
   });   
}


function makeStopwatch() {
   let start = process.hrtime();
   return () => {
      let [sec, nano] = process.hrtime(start);
      return `${sec}.${String(Math.round(nano / 1e6)).padStart(3, '0')}`;
   };
}


function main() {
   let things = db.prepare('select * from sqlite_master').all();
   if (things.length === 0) {
      createDb();
   }

   let sw = makeStopwatch();
   db.transaction(() => {
      db
         .prepare('update obj set val = json_set(val, :path, :newstring) where id = 10')
         .run({
            path: '$.prop-199[999]',
            newstring: makeRandomString(Ns)
         })
   })();
   console.log("Time: ", sw());
}


if (require.main === module) {
   main();
}
