common
   assert
   filter
   multimap
   mmapDelete
   produceArray
   zip
   mmapAdd
-----
ExpRecords ::= class ExpRecords {
   constructor(kvpairs) {
      this.map = new Map(kvpairs);
   }

   static fromKeyValPairs(kvpairs) {
      return new $.ExpRecords(kvpairs);
   }

   get size() {
      return this.map.size;
   }

   get rkey2pairFn() {
      return rkey => [rkey, this.map.get(rkey)];
   }

   // [Symbol.iterator]() {
   //    return this.map[Symbol.iterator]();
   // }

   pairs() {
      return this.map;
   }

   records() {
      return this.map.entries();
   }

   keys() {
      return this.map.keys();
   }

   hasAt(rkey) {
      return this.map.has(rkey);
   }

   valueAt(rkey) {
      return this.map.get(rkey);
   }

   valueAtX(rkey) {
      return this.map.get(rkey);
   }

   recordAtX(rkey) {
      return [rkey, this.valueAt(rkey)];
   }

   addPair(rkey, rval) {
      $.assert(() => !this.hasAt(rkey));

      this.map.set(rkey, rval);
   }

   addPairs(recs) {
      for (let [rkey, rval] of recs) {
         this.addPair(rkey, rval);
      }
   }

   removeAt(rkey) {
      let didDelete = this.map.delete(rkey);
      $.assert(() => didDelete);
   }
}
ImpRecords ::= class ImpRecords {
   constructor(recs) {
      this.set = new Set(recs);
   }

   static fromKeyValPairs(kvpairs) {
      return new $.ImpRecords(
         $.map(kvpairs, ([rkey, rval]) => {
            $.assert(() => rkey === rval);
            return rkey;
         })
      );
   }

   get size() {
      return this.set.size;
   }

   get rkey2pairFn() {
      return rkey => [rkey, rkey];
   }

   // [Symbol.iterator]() {
   //    return this.set[Symbol.iterator]();
   // }

   pairs() {
      return this.set.entries();
   }

   records() {
      return this.set[Symbol.iterator]();
   }

   keys() {
      return this.set[Symbol.iterator]();
   }

   hasAt(rkey) {
      return this.set.has(rkey);
   }

   valueAt(rkey) {
      return this.hasAt(rkey) ? rkey : undefined;
   }

   valueAtX(rkey) {
      return rkey;
   }

   recordAtX(rkey) {
      return rkey;
   }

   addPair(rkey, rval) {
      $.assert(() => rkey === rval && !this.hasAt(rkey));

      this.set.add(rkey);
   }

   addPairs(recs) {
      for (let [rkey, rval] of recs) {
         this.addPair(rkey, rval);
      }
   }

   removeAt(rkey) {
      let didDelete = this.set.delete(rkey);
      $.assert(() => didDelete);
   }
}
RecDependencies ::= class RecDependencies {
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
deleteIntersection ::= function (recsA, recsB) {
   let [G, L] = $.greaterLesser(recsA, recsB);

   for (let rkey of L.keys()) {
      if (G.hasKey(rkey)) {
         G.removeAt(rkey);
         L.removeAt(rkey);
      }
   }
}
