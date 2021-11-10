common
   arraysEqual
   assert
   check
dedb-index
   copyIndex
   indexHitCount
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
protoIndex ::= ({
   recordsAt: 0
})
makeIndexInstance ::= function (attrs, {isUnique, isKeyed}) {
   return {
      dispatch: 'index-instance',
      attrs: Array.from(attrs),
      isUnique: isUnique,
      isKeyed: isKeyed,
      records: new Map,
   }
}
indexHitScore ::= function (index, boundAttrs) {
   let hits = $.indexHitCount(index.attrs, boundAttrs);

   if (index.isUnique && hits === index.attrs.length) {
      return 1000 + hits;
   }
   else {
      return hits;
   }
}
indexRefUnique ::= function (inst, keys) {
   $.assert(() => inst.isUnique);

   let [result, unspecified] = $.indexAt(inst, keys);

   if (result === undefined) {
      return undefined;
   }

   $.check(unspecified === 0);

   return result;
}
indexRef ::= function* (index, keys) {
   let [map, unspecified] = $.indexAt(inst, keys);

   if (map === undefined) {
      return undefined;
   }

   yield* (function* rec(map, unspecified) {
      if (unspecified === 0) {
         if (index.isUnique) {
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
rebuildIndex ::= function (inst, recKeyVals) {
   inst.records.clear();

   for (let [recKey, recVal] of recKeyVals) {
      $.indexAdd(inst, recKey, recVal);
   }
}
indexAdd ::= function (inst, recKey, recVal=recKey) {
   $.assert(() => inst.isKeyed || recKey === recVal);

   let {attrs, records: map} = inst;

   for (let i = 0; i < attrs.length; i += 1) {
      let key = recVal[attrs[i]];

      if (i + 1 === attrs.length) {
         if (map.has(key)) {
            if (inst.isUnique) {
               throw new Error(`Unique index violation`);
            }
            else if (inst.isKeyed) {
               map.get(key).set(recKey, recVal);
            }
            else {
               map.get(key).add(recVal);
            }
         }
         else {
            let rec = inst.isKeyed ? [recKey, recVal] : recVal;

            map.set(key, inst.isUnique ? rec : new (inst.isKeyed ? Map : Set)([rec]));
         }
      }
      else {
         let next = map.get(key);

         if (next === undefined) {
            next = new Map;
            map.set(key, next);
         }

         map = next;
      }
   }
}
indexRemove ::= function (inst, recKey, recVal=recKey) {
   $.assert(() => inst.isKeyed || recKey === recVal);

   (function go(i, map) {
      let key = recVal[inst.attrs[i]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }

      if (i + 1 === inst.attrs.length) {
         if (inst.isUnique) {
            map.delete(key);
         }
         else {
            let bucket = map.get(key);

            bucket.delete(recKey);

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
      dispatch: 'index-instance.reduced',
      original: inst,
      numBounds,
      template: Array.from(inst.attrs, attr => bindings[attr])
   }
}
indexAt ::= Object.assign(function indexAt(inst, keys) {
   return indexAt.methods[inst.dispatch](inst, keys[Symbol.iterator]());
}, {
   methods: {
      'index-instance': function (inst, ikeys) {
         let {attrs, records: map} = inst;
         let unspecified = attrs.length;

         while (unspecified > 0) {
            let {done, value: key} = ikeys.next();

            if (done) {
               break;
            }

            map = map.get(key);

            if (map === undefined) {
               break;
            }

            unspecified -= 1;
         }

         return [map, unspecified];
      },

      'index-instance.reduced': function (inst, ikeys) {
         let {numBounds, original, template} = inst;

         return $.indexAt(original, (function* () {
            for (let thing of template) {
               if (thing !== undefined) {
                  numBounds -= 1;
                  yield thing;
               }
               else {
                  let {value, done} = ikeys.next();

                  if (done) {
                     $.check(numBounds === 0, `Too few components in a reduced index`);
                     return;
                  }

                  yield value;
               }
            }
         })())
      }
   }   
})
