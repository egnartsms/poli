common
   map
   trackingFinal
-----
indexOn ::= function (attrs, options={}) {
   let idx = Array.from(attrs);
   idx.isUnique = !!options.isUnique;
   return idx;
}
superIndexOfAnother ::= function (index1, index2) {
   let len = $.commonArrayPrefixLength(index1, index2);
   if (len === index2.length) {
      return index1;
   }
   else if (len === index1.length) {
      return index2;
   }
   else {
      return null;
   }
}
copyIndex ::= function (index) {
   let copy = Array.from(index);
   copy.isUnique = index.isUnique;
   return copy;
}
indexBindAttr ::= function (index, attr) {
   let i = index.indexOf(attr);
   if (i !== -1) {
      index.splice(i, 1);
   }
}
indexBound ::= function (index, boundAttrs) {
   let reducedIndex = $.copyIndex(index);
   for (let attr in boundAttrs) {
      $.indexBindAttr(reducedIndex, attr);
   }
   return reducedIndex;
}
isIndexCovered ::= function (index) {
   return index.length === 0;
}
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
indexMultiAt ::= function (index, attr2val) {
   let map = index.value;

   for (let attr of index) {
      let key = attr2val(attr);
      
      map = map.get(key);

      if (map === undefined) {
         return [];
      }
   }

   // At this point map is not already a map
   return index.isUnique ? [map] : map;
}
