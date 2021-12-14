common
   assert
   check
   hasOwnProperty
   trackingFinal
   filter
dedb-relation
   recKeyBindingMakesSenseFor
dedb-index-instance
   indexRef
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
   // $.check(rkey === undefined || $.recKeyBindingMakesSenseFor(rel), () =>
   //    `Binding rec key does not make sense for the relation '${rel.name}'`
   // );

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
   if (rel.class === $.clsBaseRelation) {
      yield bindings[$.recKey];

      for (let attr of rel.attrs) {
         yield $.hasOwnProperty(bindings, attr) ? bindings[attr] : undefined;
      }

      return;
   }

   if (rel.class === $.clsDerivedRelation) {
      for (let lvar of rel.config0.outVars) {
         yield $.hasOwnProperty(bindings, lvar) ? bindings[lvar] : undefined;
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

   if (proj.rel.class === $.clsBaseRelation) {
      $.updateBaseProjection(proj);
   }
   else if (proj.rel.class === $.clsDerivedRelation) {
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
projectionSizeEstimate ::= function (proj) {
   // Either a real size or an estimate (in case of hit projections)
   if (proj.class === $.clsDerivedProjection) {
      return proj.records.size;
   }

   if (proj.class === $.clsFullProjection || proj.class === $.clsNoHitProjection) {
      return proj.rel.records.size;
   }

   if (proj.class === $.clsUniqueHitProjection ||
         proj.class === $.clsRecKeyBoundProjection) {
      return 1;
   }

   if (proj.class === $.clsHitProjection) {
      return 10;  // just a guess
   }

   throw new Error;
}
projectionRecords ::= function (proj) {
   if (proj.class === $.clsDerivedProjection) {
      return proj.records;
   }

   if (proj.class === $.clsFullProjection) {
      return proj.rel.records;
   }

   if (proj.class === $.clsUniqueHitProjection) {
      return proj.rec === undefined ? [] : [proj.rec];
   }

   if (proj.class === $.clsHitProjection) {
      let {indexInstance, indexKeys, filterIndexedBy} = proj;

      return $.filter(
         $.indexRef(indexInstance, indexKeys),
         $.predFilterBy(proj.isKeyed, filterIndexedBy)
      );
   }

   if (proj.class === $.clsNoHitProjection) {
      return $.filter(proj.rel.records, $.predFilterBy(proj.isKeyed, proj.filterBy));
   }

   if (proj.class === $.clsRecKeyBoundProjection) {
      if (proj.rval === undefined) {
         return [];
      }

      return [proj.isKeyed ? [proj.rkey, proj.rval] : proj.rval];
   }

   throw new Error;   
}
projectionRecordAt ::= function (proj, rkey) {
   if (proj.class === $.clsDerivedProjection) {
      return proj.records.recordAt(rkey);
   }

   if (proj.class === $.clsFullProjection) {
      return proj.rel.records.recordAt(rkey);
   }

   if (proj.class === $.clsNoHitProjection ||
         proj.class === $.clsHitProjection ||
         proj.class === $.clsUniqueHitProjection) {
      let rec = proj.rel.records.recordAt(rkey);

      if (rec === undefined) {
         return undefined;
      }

      let rval = proj.isKeyed ? rec[1] : rec;

      return $.suitsFilterBy(rval, proj.filterBy) ? rec : undefined;
   }

   throw new Error;
}
projectionRvalAtExisting ::= function (proj, rkey) {
   if (!proj.isKeyed) {
      return rkey;
   }
   
   if (proj.class === $.clsFullProjection ||
         proj.class === $.clsNoHitProjection ||
         proj.class === $.clsHitProjection) {
      return proj.rel.records.valueAt(rkey);
   }

   if (proj.class === $.clsUniqueHitProjection) {
      return proj.rec[1];
   }

   if (proj.class === $.clsRecKeyBoundProjection) {
      return proj.rval;
   }

   if (proj.class === $.clsDerivedProjection) {
      return proj.records.valueAt(rkey);
   }

   throw new Error;
}
