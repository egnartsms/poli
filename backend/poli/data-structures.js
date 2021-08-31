-----
AugmentedMap ::= class AugmentedMap extends Map {
   add([key, val]) {
      return this.set(key, val);
   }

   getEntry(key) {
      return this.has(key) ? [key, this.get(key)] : undefined;
   }
}
AugmentedSet ::= class AugmentedSet extends Set {
   get(rec) {
      return this.has(rec) ? rec : undefined;
   }

   getEntry(rec) {
      return this.has(rec) ? rec : undefined;
   }
}
BidiMap ::= class BidiMap extends Map {
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