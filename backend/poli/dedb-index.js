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
   let copy = Array.from(index);
   copy.isUnique = index.isUnique;
   return copy;
}
reduceIndex ::= function (index, attrs) {
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
indexHitCount ::= function (index, boundAttrs) {
   let i = 0;

   while (i < index.length && boundAttrs.includes(index[i])) {
      i += 1;
   }

   return i;
}
isIndexFullHit ::= function (index, boundAttrs) {
   return $.indexHitCount(index, boundAttrs) === index.length;
}