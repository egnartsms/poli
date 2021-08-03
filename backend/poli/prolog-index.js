common
   map
   trackingFinal
-----
buildIndex ::= function (index, facts) {
   index.value = new Map;

   for (let fact of facts) {
      $.indexAdd(index, fact);
   }
}
indexAdd ::= function (index, fact) {
   let map = index.value;

   for (let [attr, isFinal] of $.trackingFinal(index)) {
      let val = fact[attr];

      if (isFinal) {
         if (map.has(val)) {
            if (index.isUnique) {
               throw new Error(`Unique index violation`);
            }
            else {
               map.get(val).push(fact);
            }
         }
         else {
            map.set(val, index.isUnique ? fact : [fact]);
         }
      }
      else {
         let next = map.get(val);

         if (next === undefined) {
            next = new Map;
            map.set(val, next);
         }

         map = next;
      }
   }
}
indexRemove ::= function (index, fact) {
   let map = index.value;

   for (let [attr, isFinal] of $.trackingFinal(index)) {
      let val = fact[attr];

      if (!map.has(val)) {
         throw new Error(`Index missing fact`);
      }

      if (isFinal) {
         map.delete(val);
      }
      else {
         map = map.get(val);

         if (next === undefined) {
            next = new Map;
            map.set(val, next);
         }

         map = next;
      }
   }
}
