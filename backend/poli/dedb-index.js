common
   all
   assert
   map
   trackingFinal
   commonArrayPrefixLength
   hasOwnDefinedProperty
   hasOwnProperty
   greatestBy

dedb-projection
   projectionFor

set-map
   setDefault

-----

*** Old junk ***

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


isFullyCoveredBy ::=
   function (index, boundAttrs) {
      return $.all(index, attr => boundAttrs.includes(attr));
   }


*** Create indices ***

getBaseIndex ::=
   function (rel, tuple) {
      let index = rel.indices.get(tuple.key);

      $.check(index !== undefined, () =>
         `Index '${tuple.key}' not found on relation '${rel.name}'`
      );

      return index;
   }


obtainDerivedIndex ::=
   :Get index identified by 'tuple' on the projection of 'rel' identified by 'bindings'

    Create projection if it does not exist yet. We don't check whether 'tuple' is available
    for 'rel'. Also, don't check for prefixes, i.e. if an index (A, B) is available then attempting
    to get (A) will fail.

   function (rel, bindings, tuple) {
      let proj = $.projectionFor(rel, bindings);

      // Here some optimizations with 0-length tuple may be implemented (0-length essentially
      // means "I just want all the records"), for example: use any other existing index in place
      // of a 0-length one. But for now we don't do any of these as it would incur more
      // complications. So we just create a 0-length index the same as any other index.
      let index = proj.indices.get(tuple.key);

      if (index === undefined) {
         index = $.makeDerivedIndex(proj, tuple);

         // 'index' should be populated if other indices exist at this moment. If none exist, this
         //  means that the projection was never populated. We enforce this invariant elsewhere.
         let exIndex = $.packShortestIndex(proj.indices);

         if (exIndex !== undefined) {
            for (let rec of $.indexRef(exIndex, [])) {
               $.indexAdd(index, rec);
            }
         }

         proj.indices.set(tuple.key, index);
      }

      return index;
   }


releaseIndex ::=
   function (index) {
      // TODO: replace this ad-hoc with generic function polymorphism
      if (!Object.hasOwn(index, 'proj')) {
         return;
      }

      $.assert(() => index.refCount > 0);

      index.refCount -= 1;

      if (index.refCount === 0) {
         $.packRemoveIndex(index.proj.indices, index);
      }

      $.releaseProjection(index.proj);
   }


makeBaseIndex ::=
   function (rel, tuple) {
      $.check(tuple.length > 0, `Cannot have 0-length indices on base relations`);

      return {
         kind: 'index',
         rel,
         tuple,
         root: Object.assign(new Map, {totalSize: 0}),
      }
   }


makeDerivedIndex ::=
   function (proj, tuple) {
      return {
         kind: 'index',
         proj,
         tuple,
         root: tuple.length === 0 ?
            (tuple.isUnique ? null : new Set) :
            Object.assign(new Map, {totalSize: 0})
      }
   }


*** Index packs ***

makeIndexPack ::=
   function () {
      return new Map;
   }


packAddIndex ::=
   function (pack, index) {
      $.check(!pack.has(index.tuple.key), () =>
         `Duplicate index within a pack: '${index.tuple.key}'`
      );

      pack.set(index.tuple.key, index);
   }


packRemoveIndex ::=
   function (pack, index) {
      $.check(pack.has(index.tuple.key), () =>
         `Index missing in a pack: '${index.tuple.key}'`
      );

      pack.delete(index.tuple.key);
   }


packBestIndex ::=
   function (pack, bindings) {
      return $.greatestBy(
         pack.values(),
         ({tuple}) => $.tupleFitnessByBindings(tuple, bindings),
         {greaterThan: $.Fitness.minimum}
      );
   }


*** Operations on indices ***

emptyIndex ::=
   function (index) {
      if (index.tuple.length === 0) {
         if (index.tuple.isUnique) {
            index.root = null;
         }
         else {
            index.root.clear();
         }
      }
      else {
         index.root.clear();
         index.root.totalSize = 0;
      }
   }


indexAdd ::=
   :Add 'rec' to 'index'.
    'attrs' if provided is the source of information instead of 'rec'. This is used with entities.

    TODO: make this generic function

   function (index, rec, attrs=rec) {
      let {tuple} = index;

      if (tuple.length === 0) {
         if (tuple.isUnique) {
            $.check(index.root === null, `Unique index violation`);
            index.root = rec;
         }
         else {
            index.root.add(rec);
         }

         return;
      }

      function go(node, level) {
         let key = attrs[tuple[level]];

         if (level + 1 === tuple.length) {
            if (tuple.isUnique) {
               $.check(!node.has(key), `Unique index violation`);
               node.set(key, rec);
            }
            else {
               $.setDefault(node, key, () => new Set).add(rec);
            }
         }
         else {
            go(
               $.setDefault(node, key, () => Object.assign(new Map, {totalSize: 0})),
               level + 1
            );
         }

         node.totalSize += 1;
      }

      go(index.root, 0);
   }


indexRemove ::=
   :Remove 'rec' from 'index'.
    'attrs' if provided is the source of information instead of 'rec'. This is used with entities.

    TODO: make this generic function

   function (index, rec, attrs=rec) {
      let {tuple} = index;

      if (tuple.length === 0) {
         if (tuple.isUnique) {
            $.check(index.root === rec, `Unique index violation`);
            index.root = null;
         }
         else {
            $.check(index.has(rec), `Index missing record`);
            index.root.delete(rec);
         }

         return;
      }

      function go(node, level) {
         let key = attrs[tuple[level]];

         $.check(node.has(key), `Index missing record`);

         if (level + 1 === tuple.length) {
            if (tuple.isUnique) {
               $.check(node.get(key) === rec, `Index corrupted`);

               node.delete(key);
            }
            else {
               let bucket = node.get(key);

               $.check(bucket.has(rec), `Index corrupted`);

               bucket.delete(rec);

               if (bucket.size === 0) {
                  node.delete(key);
               }
            }
         }
         else {
            let next = node.get(key);

            go(next, level + 1);

            if (next.size === 0) {
               node.delete(key);
            }
         }

         node.totalSize -= 1;
      }

      go(index.root, 0);
   }


indexRef ::=
   function* (index, keys) {
      let {tuple} = index;

      if (tuple.length === 0) {
         if (tuple.isUnique) {
            if (tuple.root !== null) {
               yield tuple.root;
            }
         }
         else {
            yield* tuple.root;
         }

         return;
      }

      yield* (function* rec(node, level) {
         if (level === tuple.length) {
            tuple.isUnique ? (yield node) : (yield* node);
         }
         else {
            let key = keys[level];

            if (key === undefined) {
               // Assuming that keys[level + N] will also be undefined for N = 1,2,...
               for (let sub of node.values()) {
                  yield* rec(sub, level + 1);
               }
            }
            else if (node.has(key)) {
               yield* rec(node.get(key), level + 1);
            }
         }
      }(index.root, 0));
   }


indexRefWithBindings ::=
   function (index, bindings) {
      return $.indexRef(index, $.tupleKeys(index.tuple, bindings));
   }
