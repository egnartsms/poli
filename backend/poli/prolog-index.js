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
            if (index.unique) {
               throw new Error(`Unique index violation`);
            }
            else {
               map.get(val).push(fact);
            }
         }
         else {
            map.set(val, index.unique ? fact : [fact]);
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
         if (map.has(val)) {
            if (index.unique) {
               throw new Error(`Unique index violation`);
            }
            else {
               map.get(val).push(fact);
            }
         }
         else {
            map.set(val, index.unique ? fact : [fact]);
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
factualProjectionIndices ::= function (indices, boundAttrs) {
   let projIndices = [];

   for (let index of indices) {
      let projIndex = [];

      for (let attr of index) {
         if (boundAttrs[attr] === undefined) {
            projIndex.push(attr);
         }
      }

      if (projIndex.length === 0) {
         if (index.unique) {
            return null;
         }
      }
      else {
         projIndex.unique = index.unique;
         projIndices.push(projIndex);
      }
   }

   return projIndices;
}
