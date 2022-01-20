common
   assert
   check
   hasOwnProperty
   trackingFinal
   filter
   isA
dedb-index-instance
   indexRef
   indexRefSize
   indexRefPairs
dedb-base
   makeProjection as: makeBaseProjection
   freeProjection as: freeBaseProjection
   updateProjection as: updateBaseProjection
   clsBaseRelation
   clsBaseProjection
   clsFullProjection
   clsUniqueHitProjection
   clsRecKeyBoundProjection
   suitsFilterBy
   predFilterBy
dedb-derived
   makeProjection as: makeDerivedProjection
   freeProjection as: freeDerivedProjection
   updateProjection as: updateDerivedProjection
   clsDerivedRelation
   clsDerivedProjection
dedb-rec-key
   recKey
   recVal
-----
clsProjection ::= ({
   name: 'projection',
   'projection': true
})
makeProjectionRegistry ::= function () {
   return Object.assign(new Map, {
      parent: null
   });
}
makeProjection ::= function (rel, bindings) {
   if (rel.class === $.clsBaseRelation) {
      return $.makeBaseProjection(rel, bindings);
   }
   else if (rel.class === $.clsDerivedRelation) {
      return $.makeDerivedProjection(rel, bindings);
   }
   else {
      throw new Error(`Cannot make projection of a relation of type '${rel.type}'`);
   }
}
projectionFor ::= function (rel, bindings) {
   let map = rel.projections;

   for (let [key, isFinal] of
         $.trackingFinal($.genProjectionKey(rel, bindings))) {
      if (map.has(key)) {
         map = map.get(key);
      }
      else {
         let next;

         if (isFinal) {
            next = {
               parent: map,
               key: key,
               proj: $.makeProjection(rel, bindings)
            };

            next.proj.regPoint = next;
         }
         else {
            next = Object.assign(new Map, {
               parent: map,
               key: key
            });
         }
         
         map.set(key, next);
         map = next;
      }
   }

   return map.proj;
}
releaseProjection ::= function (proj) {
   $.check(proj.refCount > 0);

   proj.refCount -= 1;

   if (proj.refCount === 0) {
      let {parent: map, key} = proj.regPoint;

      map.delete(key);

      while (map.size === 0 && map.parent !== null) {
         map.parent.delete(map.key);
         map = map.parent;
      }

      $.freeProjection(proj);      
   }
}
genProjectionKey ::= function* (rel, bindings) {
   if (rel.class === $.clsBaseRelation || rel.class === $.clsDerivedRelation) {
      for (let attr of rel.logAttrs) {
         yield $.hasOwnProperty(bindings, attr) ? bindings[attr] : undefined;
      }

      return;
   }

   throw new Error;
}
freeProjection ::= function (proj) {
   let {rel} = proj;

   if (rel.class === $.clsBaseRelation) {
      $.freeBaseProjection(proj);
   }
   else if (rel.class === $.clsDerivedRelation) {
      $.freeDerivedProjection(proj);
   }
   else {
      throw new Error;
   }
}
invalidateProjections ::= function (rootProjs) {
   let stack = Array.from(rootProjs);

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
   if (proj.isValid) {
      return;
   }

   if ($.isA(proj, $.clsBaseProjection)) {
      $.updateBaseProjection(proj);
   }
   else if ($.isA(proj, $.clsDerivedProjection)) {
      $.updateDerivedProjection(proj);
   }
   else {
      throw new Error;
   }
}
