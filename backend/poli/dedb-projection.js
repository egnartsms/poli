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
   suitsFilterBy
   predFilterBy
dedb-derived
   makeProjection as: makeDerivedProjection
   freeProjection as: freeDerivedProjection
   updateProjection as: updateDerivedProjection
dedb-rec-key
   recKey
   recVal
-----
makeProjectionRegistry ::= function () {
   return Object.assign(new Map, {
      parent: null
   });
}
makeProjection ::= function (rel, bindings) {
   if (rel.kind === 'base') {
      return $.makeBaseProjection(rel, bindings);
   }
   else if (rel.kind === 'derived') {
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
   for (let attr of rel.logAttrs) {
      yield $.hasOwnProperty(bindings, attr) ? bindings[attr] : undefined;
   }
}
freeProjection ::= function (proj) {
   let {rel} = proj;

   if (rel.kind === 'base') {
      $.freeBaseProjection(proj);
   }
   else if (rel.kind === 'derived') {
      $.freeDerivedProjection(proj);
   }
   else {
      throw new Error;
   }
}
invalidate ::= function (root) {
   // root is either a projection or a base relation
   let stack = [root];

   while (stack.length > 0) {
      let proj = stack.pop();

      stack.push(...proj.validRevDeps);

      proj.validRevDeps.clear();
      proj.isValid = false;
   }
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if (proj.kind === 'derived') {
      $.updateDerivedProjection(proj);
   }
   else if (proj.rel.kind === 'base') {
      $.updateBaseProjection(proj);
   }
   else {
      throw new Error;
   }
}
referentialSize ::= function (proj) {
   if (proj.kind === 'unique-hit' || proj.kind === 'rec-key-bound') {
      return 1;
   }

   return proj.fullRecords.size;
}
projectionPairs ::= function (proj) {
   if (proj.kind === 'derived') {
      return proj.records.pairs();
   }

   if (proj.kind === 'full') {
      return proj.rel.records.pairs();
   }

   if (proj.kind === 'unique-hit' || proj.kind === 'rec-key-bound') {
      return [[proj.rkey, proj.rval]];
   }

   if (proj.kind === 'partial') {
      return $.filter(
         proj.rel.records.pairs(),
         ([, rval]) => $.suitsFilterBy(rval, proj.filterBy)
      )
   }

   throw new Error;   
}
