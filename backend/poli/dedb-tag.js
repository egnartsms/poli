dedb-base
   * as: base
dedb-derived
   * as: derived
dedb-version
   versionTaggables
dedb-index
   indexTaggables
dedb-projection
   freeProjection
common
   Queue

-----

taggables ::=
   function* (obj) {
      switch (obj.kind) {
         case 'proj':
            if (obj.rel.kind === 'base') {
               yield* $.base.projectionTaggables(obj);
            }
            else if (obj.rel.kind === 'derived') {
               yield* $.derived.projectionTaggables(obj);
            }
            else {
               throw new Error(`Not impl`);
            }
            break;

         case 'ver':
            yield* $.versionTaggables(obj);
            break;

         case 'index':
            yield* $.indexTaggables(obj);
            break;

         default:
            throw new Error(`Invalid object kind fed to 'taggables()': '${obj.kind}'`);
      }
   }


walkTaggables ::=
   function* (root) {
      let met = new Map;
      let queue = new $.Queue;

      queue.enqueue(root);

      while (!queue.isEmpty) {
         let obj = queue.dequeue();

         if (met.has(obj)) {
            if (met.get(obj) === false) {
               yield obj;
               met.set(obj, true);
            }
         }
         else {
            queue.enqueueAll($.taggables(obj));
            met.set(obj, false);
         }
      }
   }


tag ::=
   function (root, tag) {
      for (let obj of $.walkTaggables(root)) {
         obj.tags.add(tag);
      }
   }


untag ::=
   function (root, tag) {
      for (let obj of $.walkTaggables(root)) {
         $.assert(() => obj.tags.has(tag));

         obj.tags.delete(tag);

         if (obj.tags.size === 0) {
            $.free(obj);
         }
      }
   }


free ::=
   function (obj) {
      switch (obj.kind) {
         case 'proj':
            $.freeProjection(obj);
            break;

         case 'ver':
            
      }
   }
