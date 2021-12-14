-----
RecordMap ::= class RecordMap {
   constructor(entries) {
      this.map = new Map(entries);
   }

   get size() {
      return this.map.size;
   }

   [Symbol.iterator]() {
      return this.map.entries();
   }

   keys() {
      return this.map.keys();
   }

   keyVals() {
      return this.map.entries();
   }

   hasKey(key) {
      return this.map.has(key);
   }

   hasRecord([key, val]) {
      return this.map.has(key);
   }

   valueAt(key) {
      return this.map.get(key);
   }

   valueAtExisting(key) {
      return this.valueAt(key);
   }

   recordAt(key) {
      return this.map.has(key) ? [key, this.map.get(key)] : undefined;
   }

   recordAtExisting(key) {
      return [key, this.map.get(key)];
   }

   addRecord([key, val]) {
      this.map.set(key, val);
   }

   addRecords(recs) {
      for (let rec of recs) {
         this.addRecord(rec);
      }
   }

   removeAt(key) {
      return this.map.delete(key);
   }

   removeRecord([key, val]) {
      return this.map.delete(key);
   }
}
RecordSet ::= class RecordSet {
   constructor(entries) {
      this.set = new Set(entries);
   }

   get size() {
      return this.set.size;
   }

   [Symbol.iterator]() {
      return this.set[Symbol.iterator]();
   }

   keys() {
      return this.set.keys();
   }

   keyVals() {
      return this.set.entries();
   }

   hasKey(key) {
      return this.set.has(key);
   }

   hasRecord(rec) {
      return this.set.has(rec);
   }

   valueAt(key) {
      return this.set.has(key) ? key : undefined;
   }

   valueAtExisting(key) {
      return key;
   }

   recordAt(key) {
      return this.valueAt(key);
   }

   recordAtExisting(key) {
      return key;
   }

   addRecord(rec) {
      this.set.add(rec);
   }

   addRecords(recs) {
      for (let rec of recs) {
         this.addRecord(rec);
      }
   }

   removeAt(key) {
      return this.set.delete(key);
   }

   removeRecord(rec) {
      return this.set.delete(rec);
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