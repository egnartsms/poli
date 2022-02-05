common
   assert
   filter
-----
ExpRecords ::= class KeyedRecords {
   constructor(kvpairs) {
      this.map = new Map(kvpairs);
   }

   static fromKeyValPairs(kvpairs) {
      return new $.ExpRecords(kvpairs);
   }

   get size() {
      return this.map.size;
   }

   [Symbol.iterator]() {
      return this.map[Symbol.iterator]();
   }

   pairs() {
      return this.map;
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
      return this.valueAt(rkey);
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
ImpRecords ::= class Records {
   constructor(tuples) {
      this.set = new Set(tuples);
   }

   static fromKeyValPairs(kvpairs) {
      return new $.ImpRecords(
         $.filter(kvpairs, ([rkey, rval]) => {
            $.assert(() => rkey === rval);
            return rkey;
         })
      );
   }

   get size() {
      return this.set.size;
   }

   [Symbol.iterator]() {
      return this.set[Symbol.iterator]();
   }

   pairs() {
      return this.set.entries();
   }

   keys() {
      return this.set;
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
deleteIntersection ::= function (recsA, recsB) {
   let [G, L] = $.greaterLesser(recsA, recsB);

   for (let rkey of L.keys()) {
      if (G.hasKey(rkey)) {
         G.removeAt(rkey);
         L.removeAt(rkey);
      }
   }
}
BidiMap ::= class BidiMap extends Map {
   // Not currently used anywhere
   constructor(entries) {
      super();

      Object.defineProperty(this, 'val2key', {
         configurable: true,
         enumerable: false,
         writable: false,
         value: new Map()
      });

      entries = entries == null ? [] : entries;
      
      for (let [k, v] of entries) {
         this.set(k, v);
      }
   }

   getKey(val) {
      return this.val2key.get(val);
   }

   delete(key) {
      if (this.has(key)) {
         let val = this.get(key);
         this.val2key.delete(val);

         return false;
      }

      return this.delete(key);
   }

   set(key, val) {
      this.val2key.set(val, key);
      return super.set(key, val);
   }
}