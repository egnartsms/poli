common
   assert
   map
   trackingFinal
-----
unique ::= 1
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
   return Object.assign(Array.from(index), {isUnique: index.isUnique});
}
reduceIndex ::= function (index, boundAttrs) {
   let reduced = $.copyIndex(index);

   for (let attr of attrs) {
      let i = reduced.indexOf(attr);
      if (i !== -1) {
         reduced.splice(i, 1);
      }
   }

   return reduced;
}
isIndexCovered ::= function (index) {
   return index.length === 0;
}
indexFitness ::= function (index, boundAttrs) {
   let i = 0;

   while (i < index.length && boundAttrs.includes(index[i])) {
      i += 1;
   }

   if (i === 0) {
      return -Infinity;
   }

   let fitness = i - index.length;

   return (fitness === 0 && index.isUnique) ? 1 : fitness;
}
uniqueIndexFullHit ::= function (index, boundAttrs) {
   return $.indexFitness(index, boundAttrs) === 1;
}
indexKeys ::= function (index, bindings) {
   let keys = [];

   for (let attr of index) {
      if (bindings[attr] === undefined) {
         break;
      }

      keys.push(bindings[attr]);
   }

   return keys;
}