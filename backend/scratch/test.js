function setSizeVsMapSize() {
   const N = 100_000;
   const M = 500;

   global.head = {};

   let entities = [];

   for (let j = 0; j < M; j += 1) {
      entities.push({
         name: 'john ' + j,
         age: 20 + (j % 20),
         number: j
      })
   }

   let link = global.head;

   // for (let i = 0; i < N; i += 1) {
   //    link.next = new Map;
   //    link = link.next;

   //    for (let j = 0; j < M; j += 1) {
   //       link.set(entities[j], entities[j]);
   //    }
   // }

   for (let i = 0; i < N; i += 1) {
      link.next = new Set;
      link = link.next;

      for (let j = 0; j < M; j += 1) {
         link.add(entities[j]);
      }
   }

   console.log("Before GC: ", process.memoryUsage());
   global.gc();
   console.log("After GC: ", process.memoryUsage());
}


function indexAccessTime() {
   function indexAt(inst, keys) {
      let {attrs} = inst;

      function* rec(map, i) {
         if (i === attrs.length) {
            yield* map;
         }
         else {
            let key = keys[i];

            if (key === undefined) {
               for (let submap of map.values()) {
                  yield* rec(submap, i + 1);
               }
            }
            else {
               map = map.get(key);

               if (map !== undefined) {
                  yield* rec(map, i + 1);
               }
            }
         }
      }

      return rec(inst.records, 0);
   }

   function indexAdd(inst, rec) {
      let {attrs, records: map} = inst;
      let i = 0;

      for (;;) {
         let key = rec[attrs[i]];

         if (i + 1 === attrs.length) {
            if (map.has(key)) {
               map.get(key).add(rec);
            }
            else {
               map.set(key, new Set([rec]));
            }

            break;
         }

         let next = map.get(key);

         if (next === undefined) {
            next = new Map;
            map.set(key, next);
         }

         map = next;
         i += 1;
      }
   }

   const attrs = [
      {
         card: 30,
         n: 3,
         name: 'continent',
         values: []
      },
      {
         card: 30,
         n: 3,
         name: 'country',
         values: []
      },
      {
         card: 30,
         n: 3,
         name: 'city',
         values: []
      }
   ];
      
   for (let attr of attrs) {
      for (let i = 0; i < attr.card; i += 1) {
         attr.values.push(attr.name + '_' + (i + 1));
      }
   }

   let inst = {
      attrs: Array.from(attrs, a => a.name),
      records: new Map
   };

   {
      let entries = [];

      (function fill(i) {
         if (i === attrs.length) {
            let rec = Object.fromEntries(entries);
            rec.cost = Math.random();
            indexAdd(inst, rec);
         }
         else {
            let {name, values, n} = attrs[i];

            for (let j = 0; j < n; j += 1) {
               for (let value of values) {
                  entries.push([name, value]);
                  fill(i + 1);
                  entries.pop();
               }
            }
         }
      })(0);
   }

   function totalCost(itor) {
      let totalCost = 0.0;
      let n = 0;

      for (let rec of itor) {
         // console.log(rec);
         totalCost += rec.cost;
         n += 1;
      }

      global.totalCost = totalCost;
      global.n = n;
   }

   const N = 1000;

   global.gc();
   console.time('ref3');
   for (let i = 0; i < N; i += 1) {
      totalCost(indexAt(inst, [undefined, undefined, 'city_3']));
   }
   console.log(global.n);
   console.timeEnd('ref3');

   global.gc();
   console.time('ref1');
   for (let i = 0; i < N; i += 1) {
      totalCost(indexAt(inst, ['continent_3', undefined, undefined]));
   }
   console.log(global.n);
   console.timeEnd('ref1');
}


if (require.main === module) {
   indexAccessTime();
}
