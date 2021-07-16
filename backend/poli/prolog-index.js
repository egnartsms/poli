common
   map
   trackingFinal
-----
buildIndices ::= function (indices, facts) {
   return new Map($.map(indices, index => [index, $.buildIndex(index, facts)]));
}
buildIndex ::= function (index, facts) {
   let idxval = new Map;

   for (let fact of facts) {
      $.indexAdd(index, idxval, fact);
   }

   return idxval;
}
indexAdd ::= function (index, idxval, fact) {
   let map = idxval;

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
projectionIndices ::= function (indices, boundAttrs) {
   let projIndices = [];
   let isScalar = false;

   for (let index of indices) {
      let projIndex = [];

      for (let attr of index) {
         if (boundAttrs[attr] === undefined) {
            projIndex.push(attr);
         }
      }

      if (projIndex.length === 0) {
         if (index.unique) {
            isScalar = true;
         }
      }
      else {
         if (index.unique === true) {
            projIndex.unique = true;
         }

         projIndices.push(projIndex);
      }
   }

   return {
      indices: projIndices,
      isScalar: isScalar
   }
}
