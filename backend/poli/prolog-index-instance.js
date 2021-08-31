common
   arraysEqual
   assert
prolog-index
   copyIndex
   rebuildIndex
-----
refIndexInstance ::= function (proj, soughtIndex) {
   for (let index of proj.indexInstances) {
      if ($.arraysEqual(index, soughtIndex)) {
         index.refcount += 1;
         return index;
      }
   }

   let idxInst = $.copyIndex(soughtIndex);

   idxInst.refcount = 1;
   idxInst.owner = proj;

   proj.indexInstances.push(idxInst);

   // For lean projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.records !== null) {
      $.rebuildIndex(idxInst, proj.records);
   }

   return idxInst;
}
releaseIndexInstance ::= function (idxInst) {
   $.assert(() => idxInst.refcount > 0);

   idxInst.refcount -= 1;

   if (idxInst.refcount === 0) {
      let i = idxInst.owner.indexInstances.indexOf(idxInst);
      $.assert(() => i !== -1);
      idxInst.owner.indexInstances.splice(i, 1);
   }
}
