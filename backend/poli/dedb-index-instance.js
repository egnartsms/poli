common
   arraysEqual
   assert
   check
dedb-index
   copyIndex
   indexKeys
-----
refIndexInstance ::= function (proj, soughtIndex) {
   for (let index of proj.myIndexInstances) {
      if ($.arraysEqual(index, soughtIndex)) {
         index.refCount += 1;
         proj.myIndexInstances.totalRefs += 1;
         return index;
      }
   }

   let idxInst = $.copyIndex(soughtIndex);

   idxInst.refCount = 1;
   idxInst.owner = proj;

   proj.myIndexInstances.push(idxInst);
   proj.myIndexInstances.totalRefs += 1;

   // For unfilled projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.records !== null) {
      $.rebuildIndex(idxInst, proj.records);
   }

   return idxInst;
}
releaseIndexInstance ::= function (idxInst) {
   let instances = idxInst.owner.myIndexInstances;

   $.assert(() => idxInst.refCount > 0);
   $.assert(() => instances.totalRefs > 0);

   idxInst.refCount -= 1;
   instances.totalRefs -= 1;

   if (idxInst.refCount === 0) {
      let i = instances.indexOf(idxInst);
      $.assert(() => i !== -1);
      instances.splice(i, 1);
   }
}
clsIndexInstance ::= ({
   name: 'indexInstance',
   'indexInstance': true
})
makeIndexInstance ::= function (attrs, {isUnique, isKeyed}) {
   return {
      class: $.clsIndexInstance,
      index: Object.assign(Array.from(attrs), {isUnique}),
      isUnique: isUnique,
      isKeyed: isKeyed,
      records: new Map,
   }
}
indexRef ::= function* (inst, keys) {
   let [map, unspecified] = $.indexAt(inst, keys);

   if (map === undefined) {
      return;
   }

   yield* (function* rec(map, unspecified) {
      if (unspecified === 0) {
         if (inst.isUnique) {
            yield map;
         }
         else {
            yield* map;
         }
      }
      else {
         for (let sub of map.values()) {
            yield* rec(sub, unspecified - 1);
         }
      }
   })(map, unspecified);
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
            if (inst.isUnique) {
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

            map.set(key, inst.isUnique ? rec : new (inst.isKeyed ? Map : Set)([rec]));
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
         if (inst.isUnique) {
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
indexReduce ::= function (inst, bindings) {
   let numBounds = 0;

   for (let attr of inst.attrs) {
      if (bindings[attr] !== undefined) {
         numBounds += 1;
      }
   }

   return {
      what: 'reduced-index-instance',
      original: inst,
      numBounds,
      template: Array.from(inst.attrs, attr => bindings[attr])
   }
}
indexAt ::= function (inst, keys) {
   keys = keys[Symbol.iterator]();

   if (inst.class === $.clsIndexInstance) {
      let {index, records: map} = inst;
      let lvl = index.length;

      while (lvl > 0) {
         let {done, value: key} = keys.next();

         if (done) {
            break;
         }

         map = map.get(key);

         if (map === undefined) {
            break;
         }

         lvl -= 1;
      }

      return [map, lvl];
   }

   // if (inst.what === 'reduced-index-instance') {
   //    let {numBounds, original, template} = inst;

   //    return $.indexAt(original, (function* () {
   //       for (let thing of template) {
   //          if (thing !== undefined) {
   //             numBounds -= 1;
   //             yield thing;
   //          }
   //          else {
   //             let {value, done} = keys.next();

   //             if (done) {
   //                $.check(numBounds === 0, `Too few components in a reduced index`);
   //                return;
   //             }

   //             yield value;
   //          }
   //       }
   //    })())
   // }

   throw new Error;
}
