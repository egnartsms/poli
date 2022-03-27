common
   arraysEqual
   assert
   all
   check
   filter
   isA
   map
dedb-base
   predFilterBy
   suitsFilterBy
   clsBaseRelation
dedb-index
   copyIndex
   indexKeys
dedb-derived
   clsDerivedProjection
dedb-relation
   rkeyX2pairFn
   rec2pair
   rec2pairFn
   rec2valFn
   pair2rec
   recordCollection
-----
refBaseInstance ::= function (rel, desired) {
   let inst = $.refExistingInstance(rel.myIndexInstances, desired);

   $.assert(() => inst !== null);

   return inst;
}
refDerivedInstance ::= function (proj, desired) {
   $.assert(() => proj.kind === 'derived');

   let inst = $.refExistingInstance(proj.myIndexInstances, desired);

   if (inst !== null) {
      return inst;
   }

   inst = $.makeIndexInstance(proj, desired);
   inst.refCount += 1;
   proj.myIndexInstances.add(inst);

   $.rebuildIndex(inst, proj.records.pairs());

   return inst;
}
refExistingInstance ::= function (indexInstances, desired) {
   for (let inst of indexInstances) {
      if ($.arraysEqual(inst.index, desired)) {
         inst.refCount += 1;
         return inst;
      }
   }

   return null;
}
releaseIndexInstance ::= function (inst) {
   $.assert(() => inst.refCount > 0);

   inst.refCount -= 1;

   if (inst.refCount === 0) {
      let deleted = inst.holder.myIndexInstances.delete(inst);

      $.assert(() => deleted);
   }
}
makeIndexInstance ::= function (holder, index) {
   $.assert(() => $.isA(holder, $.clsDerivedProjection, $.clsBaseRelation));

   return {
      refCount: 0,
      holder,
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
indexRefPairs ::= function (inst, keys) {
   return $.map($.indexRef(inst, keys), inst.holder.rkey2pairFn);
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
rebuildIndex ::= function (inst, pairs) {
   inst.map.clear();

   for (let [rkey, rval] of pairs) {
      $.indexAdd(inst, rkey, rval);
   }
}
indexAdd ::= function (inst, rkey, rval=rkey) {
   $.assert(() => inst.holder.isKeyed || rkey === rval);

   let {index} = inst;

   (function go(lvl, map) {
      let key = rval[index[lvl]];

      if (lvl + 1 === index.length) {
         if (index.isUnique) {
            if (map.has(key)) {
               throw new Error(`Unique index violation`);
            }

            map.set(key, rkey);
         }
         else {
            let bucket = map.get(key);

            if (bucket === undefined) {
               bucket = new Set;
               map.set(key, bucket);
            }

            bucket.add(rkey);
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
indexRemove ::= function (inst, rkey, rval=rkey) {
   $.assert(() => inst.holder.isKeyed || rkey === rval);

   let {index} = inst;

   (function go(lvl, map) {
      let key = rval[index[lvl]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }  

      if (lvl + 1 === index.length) {
         if (index.isUnique) {
            map.delete(key);
         }
         else {
            let bucket = map.get(key);

            bucket.delete(rkey);

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
