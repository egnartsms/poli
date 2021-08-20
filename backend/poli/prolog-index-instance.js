common
   arraysEqual
   assert
prolog-index
   copyIndex
   buildIndex
prolog-projection
   isFullProjection
-----
refIndexInstance ::= function (proj, soughtIndex) {
   for (let index of proj.indexInstances) {
      if ($.arraysEqual(index, soughtIndex)) {
         index.refcount += 1;
         return index;
      }
   }

   if (soughtIndex.isUnique && proj.rel.isBase && $.isFullProjection(proj)) {
      // Reuse unique index of the relation itself which is always kept around
      let index = proj.rel.uniqueIndices.find(idx => $.arraysEqual(idx, soughtIndex));      
      index.refcount += 1;
      return index;
   }

   let idxInst = $.copyIndex(soughtIndex);

   idxInst.refcount = 1;
   idxInst.parent = proj;
   proj.indexInstances.push(idxInst);

   // For lean projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.value !== null) {
      $.buildIndex(idxInst, proj.value);
   }

   return idxInst;
}
releaseIndexInstance ::= function (idxInst) {
   $.assert(idxInst.refcount > 0);

   idxInst.refcount -= 1;

   if (idxInst.refcount === 0) {
      let i = idxInst.parent.indexInstances.indexOf(idxInst);
      $.assert(i !== -1);
      idxInst.parent.indexInstances.splice(i, 1);
   }
}
