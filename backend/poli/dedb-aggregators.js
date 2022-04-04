-----
sortedIndex ::= function (array, newKey, fnkey) {
   let lo = 0;
   let hi = array.length - 1;

   while (lo <= hi) {
      let mi = Math.floor((lo + hi) / 2);
      let miKey = fnkey(array[mi]);

      if (newKey < miKey) {
         hi = mi - 1;
      }
      else {
         lo = mi + 1;
      }
   }

   return lo;
}
concatenate ::= function (tvar, {with: separator, sortBy}) {
   // Sort records and concatenate values with a given separator.
   // The implementation is O(n) so not intended for too many values inside 1 group.
   let proto = {
      add(rec) {
         this.recs.splice(
            $.sortedIndex(this.recs, rec[sortBy], rec => rec[sortBy]), 0, rec
         );
      },

      remove(rec) {
         this.recs.splice(this.recs.indexOf(rec), 1);
      },

      value() {
         return Array.from(this.recs, rec => rec[tvar]).join(separator);
      }
   }

   return {
      make() {
         return {
            __proto__: proto,
            recs: []
         }
      },

      vars: [tvar, sortBy]
   }
}
sum ::= function (tvar) {
   let proto = {
      add(rec) {
         this.sum += rec[tvar];
      },

      remove(rec) {
         this.sum -= rec[tvar];
      },

      value() {
         return this.sum;
      }
   }

   return {
      make() {
         return {
            __proto__: proto,
            sum: 0
         }
      },

      vars: [tvar]
   }
}
min ::= function (tvar, by) {
   // Heap-based implementation
   let proto = {
      add(rec) {
         this.recs.splice(
            $.sortedIndex(this.recs, rec[by], rec => rec[by]), 0, rec
         );
      },

      remove(rec) {
         this.recs.splice(this.recs.indexOf(rec), 1);
      },

      value() {
         return this.recs[0][tvar];
      }
   }

   return {
      make() {
         return {
            __proto__: proto,
            recs: []
         }
      },

      vars: [tvar, by]
   }
}