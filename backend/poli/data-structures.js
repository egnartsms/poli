-----
RecordMap ::= class RecordMap {
   constructor() {
      this.map = new Map;
   }

   valueAt(key) {
      return this.map.get(key);
   }

   add([key, val]) {
      return this.set(key, val);
   }

   // getEntry(key) {
   //    return this.has(key) ? [key, this.get(key)] : undefined;
   // }
}
RecordSet ::= class RecordSet {
   constructor() {
      this.set = new Set;
   }

   valueAt(key) {
      return this.set.has(key) ? key : undefined;
   }
   
   get(key) {
      return this.has(key) ? key : undefined;
   }

   // getEntry(key) {
   //    return this.has(key) ? key : undefined;
   // }
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