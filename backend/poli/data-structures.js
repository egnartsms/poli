common
   assert
   filter
   multimap
   mmapDelete
   produceArray
   zip
   mmapAdd
-----

RecDependencies ::=
   class RecDependencies {
      constructor(numDeps) {
         // forward: rec -> [subrec, subrec, ...]
         this.rec2subs = new Map;
         // backward: [ {subrec -> Set{rec, rec, ...}}, ... ], numDeps in length
         this.Asub2recs = $.produceArray(numDeps, () => new Map);
      }

      [Symbol.iterator]() {
         return this.rec2subs.keys();
      }

      get size() {
         return this.rec2subs.size;
      }

      has(rec) {
         return this.rec2subs.has(rec);
      }

      clear() {
         this.rec2subs.clear();
         for (let mmap of this.Asub2recs) {
            mmap.clear();
         }
      }

      add(rec, subs) {
         subs = Array.from(subs);
         this.rec2subs.set(rec, subs);

         for (let [mmap, sub] of $.zip(this.Asub2recs, subs)) {
            if (sub !== null) {
               $.mmapAdd(mmap, sub, rec);
            }
         }
      }

      removeSub(depNum, sub) {
         // We need to make a copy because this set is going to be modified inside the loop
         let recs = Array.from(
            // .get(sub) might very well return undefined. Imagine this:
            // 'rec' depends on ['sub1', 'sub2', 'sub3'].
            // Then 'sub1' and 'sub2' are both removed from subprojections, so this
            // function is called 2 times. But during the first call, 'rec' will be entirely
            // deleted, so the second call won't find anything. We should handle this.
            this.Asub2recs[depNum].get(sub) ?? []
         );

         for (let rec of recs) {
            this.remove(rec);
         }

         return recs;
      }

      remove(rec) {
         let subs = this.rec2subs.get(rec);

         for (let [sub2recs, sub] of $.zip(this.Asub2recs, subs)) {
            if (sub !== null) {
               $.mmapDelete(sub2recs, sub, rec);
            }
         }

         this.rec2subs.delete(rec);
      }
   }

deleteIntersection ::=
   function (recsA, recsB) {
      let [G, L] = $.greaterLesser(recsA, recsB);

      for (let rkey of L.keys()) {
         if (G.hasKey(rkey)) {
            G.removeAt(rkey);
            L.removeAt(rkey);
         }
      }
   }
