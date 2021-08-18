common
   assert
   hasOwnProperty
   hasNoEnumerableProps
   trackingFinal
prolog-fact
   * as: fact
prolog-infer
   * as: infer
-----
isFullProjection ::= function (proj) {
   return $.hasNoEnumerableProps(proj.boundAttrs);
}
makeProjection ::= function (rel, boundAttrs) {
   return (rel.isFactual ? $.fact.makeProjection : $.infer.makeProjection)(rel, boundAttrs);
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
   $.assert(proj.refcount > 0);

   proj.refcount -= 1;

   if (proj.refcount === 0) {
      // By the time a projection's refcount drops to 0, nobody must be using it
      // (otherwise the refcount would not have dropped to 0).
      $.assert(proj.latestVersion === null);
      // Indices should've been released before the projection itself
      $.assert(proj.indices.length === 0);
      // Strictly speaking, there must not be either valid or invalid projections that
      // depend on this one if its reference counts drops to 0. That would be logical
      // error in our code. But we don't track invalid reverse dependencies, so at least
      // make an assert for valid ones.
      $.assert(proj.validRevDeps.size === 0);

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
   (proj.rel.isFactual ? $.fact.freeProjection : $.infer.freeProjection)(proj);
}