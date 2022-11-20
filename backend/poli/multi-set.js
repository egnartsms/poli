common
   check

-----

MultiSet ::=
   class MultiSet {
      constructor() {
         this.map = new Map;
      }

      has(item) {
         return this.map.has(item);
      }

      add(item) {
         this.map.set(item, (this.map.get(item) ?? 0) + 1);
      }

      // 'remove' throws if 'item' is not here. This is in contrast with 'delete'.
      remove(item) {
         let count = this.map.get(item);

         $.check(count !== undefined);

         if (count == 1) {
            this.map.delete(item);
            return true;
         }
         else {
            this.map.set(item, count - 1);
            return false;
         }
      }

      clear() {
         this.map.clear();
      }

      [Symbol.iterator]() {
         return this.map.keys();
      }
   }

