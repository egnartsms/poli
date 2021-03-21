/**
 * Test performance of some of the SQLite json extension operations.
*/

const fs = require('fs');

function makeStopwatch() {
   let start = process.hrtime();
   return () => {
      let [sec, nano] = process.hrtime(start);
      return `${sec}.${String(Math.round(nano / 1e6)).padStart(3, '0')}`;
   };
}


function main() {
   console.time();

   let map = new WeakMap;
   const N = 5_000_000;
   let thresh = N / 10;
   let nth = 0;
   let pkey;

   for (let i = 0; i < Infinity; i += 1) {
      let key1 = {};
      // let key2 = {};
      map.set(key1, {});
      // map.set(key1, {mykey: key2});
      // map.set(key2, {mykey: key1});
      // key1 = null; key2 = null;
      // pkey = key1;

      if (i > thresh) {
         nth += 1;
         let hsize = Math.round(process.memoryUsage().heapUsed / (1 << 20));
         console.log(`${nth}/10, MB: ${hsize}`);
         thresh += N / 10;
         // gc();
         // pkey = {};
         // if (hsize > 500) {
         //    gc();
         // }
      }
   }

   console.timeEnd();

   console.log("Done!");
   pkey = null;
   gc();

   {
      console.log(typeof map);
      let fd = fs.openSync("/dev/stdin", "rs");
      fs.readSync(fd, new Buffer(1), 0, 1);
      fs.closeSync(fd);
   } 
}


if (require.main === module) {
   main();
}


let rollback = new Map;


function propSet(obj, key, val) {
   let minusDelta = minusDeltaFor(obj);
   if (!minusDelta.hasOwnProperty(key)) {
      // Save original value
      minusDelta[key] = obj.hasOwnProperty(key) ? obj[key] : nihil;
   }
   obj[key] = val;
}


function delprop(obj, key) {
   if (!obj.hasOwnProperty(key))
      return;

   let minusDelta = minusDeltaFor(obj);
   if (!minusDelta.hasOwnProperty(key)) {
      // Save original value
      minusDelta[key] = obj[key];
   }
   delete obj[key];
}
