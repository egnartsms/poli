common
   arraysEqual
   assert
dedb-index
   copyIndex
   rebuildIndex
-----
refIndexInstance ::= function (proj, soughtIndex) {
   for (let index of proj.myIndexInstances) {
      if ($.arraysEqual(index, soughtIndex)) {
         index.refcount += 1;
         proj.myIndexInstances.totalRefs += 1;
         return index;
      }
   }

   let idxInst = $.copyIndex(soughtIndex);

   idxInst.refcount = 1;
   idxInst.owner = proj;

   proj.myIndexInstances.push(idxInst);
   proj.myIndexInstances.totalRefs += 1;

   // For unfilled projections, we cannot build index right away. Will do that when the
   // projection fills up.
   if (proj.records !== null) {
      $.rebuildIndex(idxInst, proj.records);
   }

   return idxInst;
}
releaseIndexInstance ::= function (idxInst) {
   let instances = idxInst.owner.myIndexInstances;

   $.assert(() => idxInst.refcount > 0);
   $.assert(() => instances.totalRefs > 0);

   idxInst.refcount -= 1;
   instances.totalRefs -= 1;

   if (idxInst.refcount === 0) {
      let i = instances.indexOf(idxInst);
      $.assert(() => i !== -1);
      instances.splice(i, 1);
   }
}
indexInstanceStorage ::= function () {
   let array = [];

   // Total reference count for all indices in the array. That doesn't include relation
   // references for unique indices that are maintained on relation level.
   // This number is used for sanity checks.
   array.totalRefs = 0;

   return array;
}
