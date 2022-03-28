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
   constructor(numDeps, isKeyed) {
      this.rkey2rval = isKeyed ? new Map : null;
      // forward: rkey -> [subkey, subkey, ...]
      this.rkey2subkeys = new Map;
      // backward: [ {subkey -> Set{rkey, rkey, ...}}, ...], numDeps in length
      this.Asubkey2rkeys = $.produceArray(numDeps, $.multimap);
   }

   pairs() {
      if (this.rkey2rval === null) {
         return $.map(this.rkey2subkeys.keys(), rec => [rec, rec]);
      }
      else {
         return this.rkey2rval.entries();
      }
   }

   records() {
      return this.rkey2rval === null ?
         this.rkey2subkeys.keys() :
         this.rkey2rval.entries();
   }

   get size() {
      return this.rkey2subkeys.size;
   }

   clear() {
      this.rkey2subkeys.clear();
      for (let mmap of this.Asubkey2rkeys) {
         mmap.clear();
      }

      if (this.rkey2rval !== null) {
         this.rkey2rval.clear();
      }
   }

   hasAt(rkey) {
      return this.rkey2subkeys.has(rkey);
   }

   valueAt(rkey) {
      return (this.rkey2rval === null) ?
         (this.rkey2subkeys.has(rkey) ? rkey : undefined) :
         this.rkey2rval.get(rkey);
   }

   valueAtX(rkey) {
      return (this.rkey2rval === null) ? rkey : this.rkey2rval.get(rkey);
   }

   get rkey2pairFn() {
      return (this.rkey2rval === null) ?
         (rkey => [rkey, rkey]) :
         (rkey => [rkey, this.rkey2rval.get(rkey)])
   }

   // [Symbol.iterator]() {
   //    if (this.rkey2rval === null) {
   //       return this.rkey2subkeys.keys();
   //    }
   //    else {
   //       return this.rkey2rval[Symbol.iterator]();
   //    }
   // }

   addDependency(rkey, subkeys, rval) {
      subkeys = Array.from(subkeys);
      this.rkey2subkeys.set(rkey, subkeys);

      for (let [mmap, subkey] of $.zip(this.Asubkey2rkeys, subkeys)) {
         if (subkey !== null) {
            $.mmapAdd(mmap, subkey, rkey);
         }
      }

      if (this.rkey2rval !== null) {
         this.rkey2rval.set(rkey, rval);
      }
   }

   removeAt(rkey) {
      let subkeys = this.rkey2subkeys.get(rkey);

      for (let [mmap, subkey] of $.zip(this.Asubkey2rkeys, subkeys)) {
         if (subkey !== null) {
            $.mmapDelete(mmap, subkey, rkey);
         }
      }

      this.rkey2subkeys.delete(rkey);

      if (this.rkey2rval !== null) {
         this.rkey2rval.delete(rkey);
      }
   }

   removeDependency(depNum, subkey) {
      // We need to make a copy because this set is going to be modified inside the loop
      let pairs = Array.from(
         // .get(subkey) might very well return undefined. Imagine this:
         // 'rkey' depends on ['subkey1', 'subkey2', 'subkey3'].
         // Then 'subkey1' and 'subkey2' are both removed from subprojections, so this
         // function is called 2 times. But during the first call, 'rkey' will be entirely
         // deleted, so the second call won't find anything. We should handle this.
         this.Asubkey2rkeys[depNum].get(subkey) ?? [],
         this.rkey2pairFn
      );

      for (let [rkey] of pairs) {
         this.removeAt(rkey);
      }

      return pairs;
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
