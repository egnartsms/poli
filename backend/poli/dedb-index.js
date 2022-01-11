common
   all
   assert
   map
   trackingFinal
   commonArrayPrefixLength
   hasOwnDefinedProperty
-----
unique ::= 1
indexFromSpec ::= function (spec) {
   let index;

   if (spec[spec.length - 1] === $.unique) {
      index = spec.slice(0, -1);
      index.isUnique = true;
   }
   else {
      index = spec.slice();
      index.isUnique = false;
   }

   return index;
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
   return Object.assign(Array.from(index), {isUnique: index.isUnique});
}
reduceIndex ::= function (index, boundAttrs) {
   let reduced = $.copyIndex(index);

   for (let attr of boundAttrs) {
      let i = reduced.indexOf(attr);
      if (i !== -1) {
         reduced.splice(i, 1);
      }
   }

   return reduced;
}
isFullyCoveredBy ::= function (index, boundAttrs) {
   return $.all(index, attr => boundAttrs.includes(attr));
}
Fitness ::= ({
   minimum: -10,  // unless we have that large indices
   hit: 0,   // this must be 0 because of the way we computeFitness()
   uniqueHit: 1,
})
indexFitness ::= function (index, boundAttrs) {
   let i = 0;

   while (i < index.length && boundAttrs.includes(index[i])) {
      i += 1;
   }

   if (i === 0) {
      return $.Fitness.minimum;
   }

   return $.computeFitness(i, index);
}
computeFitness ::= function (len, index) {
   let diff = len - index.length;

   if (diff === 0 && index.isUnique) {
      return $.Fitness.uniqueHit;
   }
   else {
      return diff;
   }
}
uniqueIndexFullHit ::= function (index, boundAttrs) {
   return $.indexFitness(index, boundAttrs) === $.Fitness.uniqueHit;
}
indexKeys ::= function (index, bindings) {
   let keys = [];

   for (let attr of index) {
      if (!$.hasOwnDefinedProperty(bindings, attr)) {
         break;
      }

      keys.push(bindings[attr]);
   }

   return keys;
}