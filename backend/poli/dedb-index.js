common
   all
   assert
   map
   trackingFinal
   commonArrayPrefixLength
   hasOwnDefinedProperty
   hasOwnProperty
   greatestBy
-----
"Tuple" means logical index: an array of columns that constitute an index. "Index" means
the actual data structure containing records/entities.

unique ::= 1

tupleFromSpec ::=
   function (spec) {
      let tuple;

      if (spec[spec.length - 1] === $.unique) {
         tuple = spec.slice(0, -1);
         tuple.isUnique = true;
      }
      else {
         tuple = spec.slice();
         tuple.isUnique = false;
      }

      return tuple;
   }


isTuplePrefixOf ::=
   function (prefix, bigger) {
      if (prefix.length > bigger.length) {
         return false;
      }

      for (let i = 0; i < prefix.length; i += 1) {
         if (prefix[i] !== bigger[i]) {
            return false;
         }
      }

      return true;
   }


superIndexOfAnother ::=
   function (index1, index2) {
      let len = $.commonArrayPrefixLength(index1, index2);
      if (len === index2.length) {
         return index1;
      }
      else if (len === index1.length) {
         return index2;
      }
      else {
         return null;
      }
   }

copyIndex ::=
   function (index) {
      return Object.assign(Array.from(index), {isUnique: index.isUnique});
   }

reduceIndex ::=
   function (index, weedOut) {
      return Object.assign(index.filter(attr => !weedOut(attr)), {
         isUnique: index.isUnique
      })
   }

isFullyCoveredBy ::=
   function (index, boundAttrs) {
      return $.all(index, attr => boundAttrs.includes(attr));
   }

Fitness ::=
   ({
      minimum: -100,  // unless we have that large indices (we don't)
      hit: 0,         // this must be 0 because of the way we computeFitness()
      uniqueHit: 1,
   })

tupleFitnessByBindings ::=
   function (tuple, bindings) {
      return $.tupleFitness(
         tuple,
         Array.from(tuple, a => Object.hasOwn(bindings, a))
      );
   }


tupleFitness ::=
   function (tuple, bounds) {
      let lim = Math.min(tuple.length, bounds.length);
      let i = 0;

      while (i < lim && bounds[i]) {
         i += 1;
      }

      if (i === 0) {
         return $.Fitness.minimum;
      }

      let diff = i - tuple.length;

      return (diff === 0 && tuple.isUnique) ? $.Fitness.uniqueHit : diff;
   }


isUniqueHitByBindings ::=
   function (index, bindings) {
      return $.tupleFitnessByBindings(index, bindings) === $.Fitness.uniqueHit;
   }


tupleKeys ::=
   function (tuple, bindings) {
      let keys = [];

      for (let attr of tuple) {
         if (!Object.hasOwn(bindings, attr)) {
            break;
         }

         keys.push(bindings[attr]);
      }

      return keys;
   }


makeIndex ::=
   function (owner, tuple) {
      return {
         refCount: 0,
         owner,
         tuple,
         map: Object.assign(new Map, {totalSize: 0}),
      }
   }


emptyIndex ::=
   function (index) {
      index.map.clear();
      index.map.totalSize = 0;
   }


findSuitableIndex ::=
   function (indices, bindings) {
      return $.greatestBy(
         indices,
         ({tuple}) => $.tupleFitnessByBindings(tuple, bindings),
         $.Fitness.minimum
      );
   }


indexAdd ::=
   :Add `rec` to `index`.
    `attrs` if provided is the source of information instead of `rec`. This is used with entities.

   function (index, rec, attrs=rec) {
      let {tuple} = index;

      (function go(lvl, map) {
         let key = attrs[tuple[lvl]];

         if (lvl + 1 === tuple.length) {
            if (tuple.isUnique) {
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
      })(0, index.map);
   }


indexRemove ::=
   :Remove `rec` from `index`.
    `attrs` if provided is the source of information instead of `rec`. This is used with entities.
   function (index, rec, attrs=rec) {
      let {tuple} = index;

      (function go(lvl, map) {
         let key = attrs[tuple[lvl]];

         if (!map.has(key)) {
            throw new Error(`Index missing fact`);
         }  

         if (lvl + 1 === tuple.length) {
            if (tuple.isUnique) {
               $.assert(() => map.get(key) === rec);

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
      })(0, index.map);
   }


indexRef ::=
   function* (index, keys) {
      let {tuple} = index;

      yield* (function* rec(map, lvl) {
         if (lvl === tuple.length) {
            tuple.isUnique ? (yield map) : (yield* map);
         }
         else {
            let key = keys[lvl];

            if (key === undefined) {
               // Assuming that keys[lvl + N] will also be undefined for N = 1,2,...
               for (let sub of map.values()) {
                  yield* rec(sub, lvl + 1);
               }
            }
            else if (map.has(key)) {
               yield* rec(map.get(key), lvl + 1);
            }
         }
      }(index.map, 0));
   }


indexRefWithBindings ::=
   function (index, bindings) {
      return $.indexRef(index, $.tupleKeys(index.tuple, bindings));
   }


refIndex ::=
   function (rel, tuple) {
      $.check(rel.kind === 'base');

      let idx = rel.indices.find(idx => $.arraysEqual(idx.tuple, tuple));

      $.check(idx !== undefined);

      idx.refCount += 1;

      return idx;
   }


releaseIndex ::=
   function (idx) {
      $.check(idx.owner.kind === 'base');

      $.assert(() => idx.refCount > 0);

      idx.refCount -= 1;

      if (idx.refCount === 0) {
         let indices = idx.owner.indices;
         let k = indices.findIndex(idx);

         $.assert(() => k !== -1);

         indices.splice(k, 1);
      }
   }
