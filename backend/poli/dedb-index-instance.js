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
   rec2pair
   rec2pairFn
   rec2valFn
   pair2rec
   recordCollection
-----
refIndexInstance ::= function (owner, desired) {
   if (owner.class === $.clsDerivedProjection) {
      return $.refDerivedInstance(owner, desired);
   }

   if (owner.class === $.clsBaseRelation) {
      let inst = $.refDesiredIndexInstance(owner, desired);

      $.assert(() => inst !== undefined);

      return inst;
   }

   // For other types of projection, it makes no sense to request index instances
   throw new Error;
}
refDerivedInstance ::= function (proj, desired) {
   let inst = $.refDesiredIndexInstance(proj, desired);

   if (inst !== undefined) {
      return inst;
   }

   inst = $.makeIndexInstance(proj, desired);
   inst.refCount += 1;
   proj.myIndexInstances.push(inst);

   // For unfilled projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.records !== null) {
      $.rebuildIndex(inst, proj.records);
   }

   return inst;
}
refDesiredIndexInstance ::= function (owner, desired) {
   for (let inst of owner.myIndexInstances) {
      if ($.arraysEqual(inst.index, desired)) {
         inst.refCount += 1;
         return inst;
      }
   }

   return undefined;
}
releaseIndexInstance ::= function (inst) {
   if (inst.class === $.clsIndexInstance) {
      let instances = inst.owner.myIndexInstances;

      $.assert(() => inst.refCount > 0);

      inst.refCount -= 1;

      if (inst.refCount === 0) {
         console.log("Deleting", inst.index, "from", inst.owner.name)
         let i = instances.indexOf(inst);
         $.assert(() => i !== -1);
         instances.splice(i, 1);
      }

      return; 
   }

   throw new Error;
}
clsIndexInstance ::= ({
   name: 'index-instance',
   'index-instance': true,
})
clsReducedIndexInstance ::= ({
   name: 'index-instance.reduced',
   'index-instance.reduced': true,
   'index-instance': true
})
makeIndexInstance ::= function (owner, index) {
   $.assert(() => $.isA(owner, $.clsDerivedProjection, $.clsBaseRelation));

   return {
      class: $.clsIndexInstance,
      refCount: 0,
      owner,
      index,
      records: new Map,
   }
}
indexRef ::= function* (inst, keys) {
   if (inst.class === $.clsIndexInstance) {
      keys = keys[Symbol.iterator]();

      let {index} = inst;

      yield* (function* rec(map, lvl) {
         if (lvl === 0) {
            index.isUnique ? (yield map) : (yield* map);
         }
         else {
            let {value: key} = keys.next();

            if (key === undefined) {
               for (let sub of map.values()) {
                  yield* rec(sub, lvl - 1);
               }
            }
            else {
               map = map.get(key);

               if (map !== undefined) {
                  yield* rec(map, lvl - 1);
               }
            }
         }
      }(inst.records, index.length));

      return;
   }

   if (inst.class === $.clsReducedIndexInstance) {
      let {instance, template, filterBy} = inst;
      let rec2val = $.rec2valFn(instance.owner);
      
      yield* $.filter(
         $.indexRef(instance, $.genKeysForReducedIndex(template, keys)),
         (rec) => $.suitsFilterBy(rec2val(rec), filterBy)
      );

      return;
   }

   throw new Error;
}
indexRefPairs ::= function (inst, keys) {
   let owner;

   if (inst.class === $.clsIndexInstance) {
      owner = inst.owner;
   }
   else if (inst.class === $.clsReducedIndexInstance) {
      owner = inst.instance.owner;
   }
   else {
      throw new Error;
   }

   return $.map($.indexRef(inst, keys), $.rec2pairFn(owner));
}
genKeysForReducedIndex ::= function* (template, keys) {
   keys = keys[Symbol.iterator]();

   for (let thing of template) {
      let value;

      if (thing !== undefined) {
         value = thing;
      }
      else {
         ({value} = keys.next());
      }

      yield value;
   }
}
indexRefOne ::= function (inst, keys) {
   let [rec] = $.indexRef(inst, keys);
   return rec;
}
indexRefWithBindings ::= function (inst, bindings) {
   return $.indexRef(inst, $.indexKeys(inst.index, bindings));
}
indexRefOneWithBindings ::= function (inst, bindings) {
   return $.indexRefOne(inst, $.indexKeys(inst.index, bindings));
}
indexRefSize ::= function (inst, keys) {
   // No special treatment for undefined keys

   if (inst.class === $.clsIndexInstance) {
      let {index, records: map} = inst;
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

   if (inst.class === $.clsReducedIndexInstance) {
      let {instance, template} = inst;

      return $.indexRefSize(instance, $.genKeysForReducedIndex(template, keys));
   }

   throw new Error;
}
rebuildIndex ::= function (inst, records) {
   inst.records.clear();

   for (let rec of records) {
      let [rkey, rval] = $.rec2pair(inst.owner, rec);
      $.indexAdd(inst, rkey, rval);
   }
}
indexAdd ::= function (inst, rkey, rval=rkey) {
   $.assert(() => inst.owner.isKeyed || rkey === rval);

   let {index, owner} = inst;

   (function go(i, map) {
      let key = rval[index[i]];

      if (i + 1 === index.length) {
         if (index.isUnique) {
            if (map.has(key)) {
               throw new Error(`Unique index violation`);
            }

            map.set(key, $.pair2rec(owner, rkey, rval));
         }
         else {
            let bucket = map.get(key);

            if (bucket === undefined) {
               bucket = new ($.recordCollection(owner));
               map.set(key, bucket);
            }

            bucket.addPair(rkey, rval);
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

         go(i + 1, next);
      }

      map.totalSize += 1;
   })(0, inst.records);
}
indexRemove ::= function (inst, rkey, rval=rkey) {
   $.assert(() => inst.owner.isKeyed || rkey === rval);

   let {index} = inst;

   (function go(i, map) {
      let key = rval[index[i]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }  

      if (i + 1 === index.length) {
         if (index.isUnique) {
            map.delete(key);
         }
         else {
            let bucket = map.get(key);

            bucket.removeAt(rkey);

            if (bucket.size === 0) {
               map.delete(key);
            }
         }
      }
      else {
         let next = map.get(key);

         go(i + 1, next);

         if (next.size === 0) {
            map.delete(key);
         }
      }

      map.totalSize -= 1;
   })(0, inst.records);
}
