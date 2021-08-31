common
   check
   hasOwnProperty
   trackingFinal
data-structures
   AugmentedMap
   AugmentedSet
prolog-base
   * as: base
prolog-derived
   * as: derived
-----
isFullBaseProjection ::= function (proj) {
   return proj.rel.isBase && $.base.isFullProjection(proj);
}
makeProjection ::= function (rel, boundAttrs) {
   return (rel.isBase ? $.base.makeProjection : $.derived.makeProjection)(rel, boundAttrs);
}
projectionFor ::= function (rel, boundAttrs) {
   let map = rel.projmap;

   for (let [attr, isFinal] of $.trackingFinal(rel.attrs)) {
      let key = $.projmapKey(boundAttrs, attr);

      if (map.has(key)) {
         map = map.get(key);
      }
      else {
         let next = isFinal ? $.makeProjection(rel, boundAttrs) : new Map;
         map.set(key, next);
         map = next;
      }
   }

   return map;
}
attrFree ::= new Object
projmapKey ::= function (boundAttrs, attr) {
   return $.hasOwnProperty(boundAttrs, attr) ? boundAttrs[attr] : $.attrFree;
}
releaseProjection ::= function (proj) {
   $.check(proj.refcount > 0);

   proj.refcount -= 1;

   if (proj.refcount === 0) {
      // By the time a projection's refcount drops to 0, nobody must be using it
      // (otherwise the refcount would not have dropped to 0).
      $.check(proj.myVer === null);
      // Index instances should've been released before the projection itself
      $.check(proj.indexInstances.length === 0);

      let rel = proj.rel;

      (function go(i, map) {
         if (i === rel.attrs.length) {
            return;
         }

         let key = $.projmapKey(proj.boundAttrs, rel.attrs[i]);

         if (i === rel.attrs.length - 1) {
            map.delete(key);
         }
         else {
            let next = map.get(key);
            go(i + 1, next);
            if (next.size === 0) {
               map.delete(key);
            }
         }
      })(0, rel.projmap);

      $.freeProjection(proj);      
   }
}
freeProjection ::= function (proj) {
   (proj.rel.isBase ? $.base.freeProjection : $.derived.freeProjection)(proj);
}
invalidateProjections ::= function (...rootProjs) {
   let stack = rootProjs;

   while (stack.length > 0) {
      let proj = stack.pop();

      for (let revdep of proj.validRevDeps) {
         stack.push(revdep);
      }

      proj.validRevDeps.clear();
      proj.isValid = false;
   }
}
updateProjection ::= function (proj) {
   (proj.rel.isBase ? $.base.updateProjection : $.derived.updateProjection)(proj);
}
makeRecords ::= function (iterable, isKeyed) {
   return new (isKeyed ? $.AugmentedMap : $.AugmentedSet)(iterable);
}
