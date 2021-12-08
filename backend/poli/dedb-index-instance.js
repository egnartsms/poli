common
   arraysEqual
   assert
   all
   check
   filter
dedb-base
   predFilterBy
   clsNoHitProjection
   clsFullProjection
dedb-index
   copyIndex
   indexKeys
dedb-derived
   clsDerivedProjection
-----
refIndexInstance ::= function (proj, desired) {
   if (proj.class === $.clsNoHitProjection) {
      return $.makeBaseInstance(proj.relation, desired, proj.filterBy);
   }

   if (proj.class === $.clsFullProjection) {
      return $.makeBaseInstance(proj.relation, desired, []);
   }

   if (proj.class === $.clsDerivedProjection) {
      return $.refDerivedInstance(proj, desired);
   }

   // For other types of projection, it makes no sense to request index instances
   throw new Error;
}
makeBaseInstance ::= function (rel, desired, filterBy) {
   let found = null;

   for (let inst of rel.indices) {
      if ($.all(desired, a => inst.index.includes(a)) &&
            $.all(inst.index, a => desired.includes(a) ||
                                    filterBy.some(([A, V]) => A === a))) {
         found = inst;
         break;
      }
   }

   $.check(found !== null,
      `Could not find index '${desired}' on a relation '${rel.name}'`
   );

   filterBy = [...filterBy];

   let template = Array.from(found.index, a => {
      if (desired.includes(a)) {
         return undefined;
      }

      let i = filterBy.findIndex(([A, V]) => A === a);
      let [, V] = filterBy[i];

      filterBy.splice(i, 1);
      
      return V;
   });

   return $.makeReducedIndexInstance({instance: found, template, filterBy});
}
refDerivedInstance ::= function (proj, desired) {
   for (let index of proj.myIndexInstances) {
      if ($.arraysEqual(index, desired)) {
         index.refCount += 1;
         return index;
      }
   }

   let inst = $.makeRefcountedIndexInstance(desired, proj);

   inst.refCount += 1;

   proj.myIndexInstances.push(inst);

   // For unfilled projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.records !== null) {
      $.rebuildIndex(inst, proj.records);
   }

   return inst;
}
releaseIndexInstance ::= function (inst) {
   if (inst.class === $.clsRefcountedIndexInstance) {
      let instances = inst.owner.myIndexInstances;

      $.assert(() => inst.refCount > 0);

      inst.refCount -= 1;

      if (inst.refCount === 0) {
         let i = instances.indexOf(inst);
         $.assert(() => i !== -1);
         instances.splice(i, 1);
      }

      return; 
   }

   if (inst.class === $.clsReducedIndexInstance) {
      return;
   }

   throw new Error;
}
clsIndexInstance ::= ({
   name: 'index-instance',
   'index-instance': true
})
clsReducedIndexInstance ::= ({
   name: 'index-instance.reduced',
   'index-instance.reduced': true,
   'index-instance': true
})
clsRefcountedIndexInstance ::= ({
   name: 'index-instance.refcounted',
   'index-instance.refcounted': true,
   'index-instance': true
})
makeIndexInstance ::= function (index, {isKeyed}) {
   return {
      class: $.clsIndexInstance,
      index,
      isKeyed,
      records: new Map,
   }
}
makeReducedIndexInstance ::= function ({instance, template, filterBy}) {
   return {
      class: $.clsReducedIndexInstance,
      instance,
      template,
      filterBy
   }
}
makeRefcountedIndexInstance ::= function (index, owner) {
   return {
      class: $.clsReducedIndexInstance,
      refCount: 0,
      index,
      isKeyed: owner.isKeyed,
      owner,
      records: new Map
   }
}
indexRef ::= function* (inst, keys) {
   keys = keys[Symbol.iterator]();

   if (inst.class === $.clsIndexInstance) {
      let {index, records: map} = inst;

      yield* (function* rec(map, lvl) {
         if (lvl === 0) {
            if (index.isUnique) {
               yield map;
            }
            else {
               yield* map;
            }
         }
         else {
            let {done, value: key} = keys.next();

            if (done) {
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
      })(map, index.length);

      return;
   }

   if (inst.class === $.clsReducedIndexInstance) {
      let {instance, template, filterBy} = inst;

      yield* $.filter(
         $.indexRef(instance, function* () {
            for (let thing of template) {
               if (thing !== undefined) {
                  yield thing;
                  continue;
               }

               let {value, done} = keys.next();

               if (done) {
                  return;
               }

               yield value;
            }
         }()),
         $.predFilterBy(instance.isKeyed, filterBy)
      );

      return;
   }

   throw new Error;
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
rebuildIndex ::= function (inst, records) {
   inst.records.clear();

   for (let rec of records) {
      $.indexAdd(inst, rec);
   }
}
indexAdd ::= function (inst, rec) {
   let [rkey, rval] = inst.isKeyed ? rec : [rec, rec];
   let {index, records: map} = inst;
   
   for (let i = 0; ; i += 1) {
      let key = rval[index[i]];

      if (i + 1 === index.length) {
         if (map.has(key)) {
            if (inst.index.isUnique) {
               throw new Error(`Unique index violation`);
            }
            else if (inst.isKeyed) {
               map.get(key).set(rkey, rval);
            }
            else {
               map.get(key).add(rval);
            }
         }
         else {
            let rec = inst.isKeyed ? [rkey, rval] : rval;

            map.set(
               key,
               inst.index.isUnique ? rec : new (inst.isKeyed ? Map : Set)([rec])
            );
         }

         break;
      }

      let next = map.get(key);

      if (next === undefined) {
         next = new Map;
         map.set(key, next);
      }

      map = next;
   }
}
indexRemove ::= function (inst, rec) {
   let [rkey, rval] = inst.isKeyed ? rec : [rec, rec];
   let {index} = inst;

   (function go(i, map) {
      let key = rval[index[i]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }  

      if (i + 1 === index.length) {
         if (inst.index.isUnique) {
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

         go(i + 1, next);

         if (next.size === 0) {
            map.delete(key);
         }
      }
   })(0, inst.records);
}
