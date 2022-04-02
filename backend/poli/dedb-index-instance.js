common
   arraysEqual
   assert
   all
   check
   filter
   isA
   map
dedb-index
   copyIndex
   indexKeys
dedb-relation
   rec2pair
   rec2pairFn
   rec2valFn
   pair2rec
   recordCollection
-----
refBaseInstance ::= function (rel, desired) {
   let inst = $.refExistingInstance(rel.myInsts, desired);

   $.assert(() => inst !== undefined);

   return inst;
}
refDerivedInstance ::= function (proj, desired) {
   $.assert(() => proj.kind === 'derived');

   let inst = $.refExistingInstance(proj.myInsts, desired);

   if (inst !== undefined) {
      return inst;
   }

   inst = $.makeIndexInstance(proj, desired);
   inst.refCount += 1;
   proj.myInsts.push(inst);

   $.rebuildIndex(inst, proj.records);

   return inst;
}
refExistingInstance ::= function (instances, desired) {
   let inst = instances.find(({index}) => $.arraysEqual(index, desired));

   if (inst !== undefined) {
      inst.refCount += 1;
   }

   return inst;
}
releaseIndexInstance ::= function (inst) {
   $.assert(() => inst.refCount > 0);

   inst.refCount -= 1;

   if (inst.refCount === 0) {
      let insts = inst.owner.myInsts;
      let idx = insts.findIndex(inst);

      $.assert(() => idx !== -1);

      insts.splice(idx, 1);
   }
}
makeIndexInstance ::= function (owner, index) {
   return {
      refCount: 0,
      owner,
      index,
      map: new Map,
   }
}
indexRef ::= function* (inst, keys) {
   let {index} = inst;

   yield* (function* rec(map, lvl) {
      if (lvl === index.length) {
         index.isUnique ? (yield map) : (yield* map);
      }
      else {
         let key = keys[lvl];

         if (key === undefined) {
            for (let sub of map.values()) {
               yield* rec(sub, lvl + 1);
            }
         }
         else {
            map = map.get(key);

            if (map !== undefined) {
               yield* rec(map, lvl + 1);
            }
         }
      }
   }(inst.map, 0));
}
indexRefWithBindings ::= function (inst, bindings) {
   return $.indexRef(inst, $.indexKeys(inst.index, bindings));
}
indexRefSize ::= function (inst, keys) {
   // No special treatment of undefined keys
   let {index, map} = inst;
   let lvl = 0;

   for (let key of keys) {
      if (lvl === index.length) {
         break;
      }

      if (!map.has(key)) {
         return 0;
      }

      map = map.get(key);
      lvl += 1;
   }

   if (lvl === index.length) {
      return index.isUnique ? 1 : map.size;
   }
   else {
      return map.totalSize;
   }
}
rebuildIndex ::= function (inst, records) {
   inst.map.clear();

   for (let rec of records) {
      $.indexAdd(inst, rec);
   }
}
indexAdd ::= function (inst, rec) {
   let {index} = inst;

   (function go(lvl, map) {
      let key = rec[index[lvl]];

      if (lvl + 1 === index.length) {
         if (index.isUnique) {
            if (map.has(key)) {
               throw new Error(`Unique index violation`);
            }

            map.set(key, rec);
         }
         else {
            let bucket;

            if (map.has(key)) {
               bucket = map.get(key);
            }
            else {
               bucket = new Set;
               map.set(key, bucket);
            }

            bucket.add(rec);
         }
      }
      else {
         let next = map.get(key);

         if (next === undefined) {
            next = Object.assign(new Map, {
               totalSize: 0
            });
            map.set(key, next);
         }

         go(lvl + 1, next);
      }

      map.totalSize += 1;
   })(0, inst.map);
}
indexRemove ::= function (inst, rec) {
   let {index} = inst;

   (function go(lvl, map) {
      let key = rec[index[lvl]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }  

      if (lvl + 1 === index.length) {
         if (index.isUnique) {
            map.delete(key);
         }
         else {
            let bucket = map.get(key);

            bucket.delete(rec);

            if (bucket.size === 0) {
               map.delete(key);
            }
         }
      }
      else {
         let next = map.get(key);

         go(lvl + 1, next);

         if (next.size === 0) {
            map.delete(key);
         }
      }

      map.totalSize -= 1;
   })(0, inst.map);
}
indexRemoveAll ::= function (inst, recs) {
   for (let rec of recs) {
      $.indexRemove(inst, rec);
   }
}