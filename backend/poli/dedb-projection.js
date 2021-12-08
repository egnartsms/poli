common
   assert
   check
   hasOwnProperty
   trackingFinal
dedb-relation
   recKeyBindingMakesSenseFor
dedb-base
   makeProjection as: makeBaseProjection
   freeProjection as: freeBaseProjection
   updateProjection as: updateBaseProjection
   clsBaseRelation
   clsFullProjection
   clsNoHitProjection
   clsHitProjection
   clsUniqueHitProjection
   clsRecKeyBoundProjection
dedb-derived
   makeProjection as: makeDerivedProjection
   freeProjection as: freeDerivedProjection
   updateProjection as: updateDerivedProjection
   clsDerivedRelation
   clsDerivedProjection
dedb-rec-key
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
makeProjection ::= function (rel, rkey, bindings) {
   if (rel.class === $.clsBaseRelation) {
      return $.makeBaseProjection(rel, rkey, bindings);
   }
   else if (rel.class === $.clsDerivedRelation) {
      return $.makeDerivedProjection(rel, rkey, bindings);
   }
   else {
      throw new Error(`Cannot make projection of a relation of type '${rel.type}'`);
   }
}
projectionFor ::= function (rel, rkey, bindings) {
   $.check(rkey === undefined || $.recKeyBindingMakesSenseFor(rel), () =>
      `Binding rec key does not make sense for the relation '${rel.name}'`
   );

   let map = rel.projections;

   for (let [key, isFinal] of
         $.trackingFinal($.genProjectionKey(rel, rkey, bindings))) {
      if (map.has(key)) {
         map = map.get(key);
      }
      else {
         let next;

         if (isFinal) {
            next = {
               parent: map,
               key: key,
               proj: $.makeProjection(rel, rkey, bindings)
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
genProjectionKey ::= function* (rel, rkey, bindings) {
   if ($.recKeyBindingMakesSenseFor(rel)) {
      yield rkey;
   }

   for (let attr of rel.attrs) {
      yield bindings[attr];
   }
}
freeProjection ::= function (proj) {
   let {relation: rel} = proj;

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

   if (proj.relation.class === $.clsBaseRelation) {
      $.updateBaseProjection(proj);
   }
   else if (proj.relation.class === $.clsDerivedRelation) {
      $.updateDerivedProjection(proj);
   }
   else {
      throw new Error;
   }
}
makeRecords ::= function (owner, iterable) {
   let records = new (owner.isKeyed ? Map : Set)(iterable);
   records.owner = owner;
   return records;
}
projectionSize ::= function (proj) {
   if (proj.class === $.clsDerivedProjection) {
      return proj.records.size;
   }

   if (proj.class === $.clsFullProjection) {
      return proj.relation.records.size;
   }

   if (proj.class === $.clsUniqueHitProjection ||
         proj.class === $.clsRecKeyBoundProjection) {
      return 1;
   }

   if (proj.class === $.clsHitProjection || proj.class === $.clsNoHitProjection) {
      return Number.MAX_SAFE_INTEGER;
   }

   throw new Error;
}
projectionRecKeyVals ::= function (proj) {
   if (proj.class === $.clsDerivedProjection) {
      return proj.records.keyVals();
   }

   if (proj.class === $.clsFullProjection) {
      return proj.relation.records.keyVals();
   }

   if (proj.class === $.clsUniqueHitProjection) {
      return proj.isKeyed ? [proj.rec] : [[proj.rec, proj.rec]];
   }

   if (proj.class === $.clsRecKeyBoundProjection) {
      if (proj.rval === undefined) {
         return [];
      }

      return [[proj.rkey, proj.rval]];
   }

   throw new Error;   
}