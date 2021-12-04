common
   assert
   check
   hasOwnProperty
   trackingFinal
dedb-relation
   recKeyBindingMakesSenseFor
dedb-base
   * as: base
dedb-derived
   * as: derived
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
makeProjection ::= function (rel, recKey, bindings) {
   if (rel.type === $.RelationType.base) {
      return $.base.makeProjection(rel, recKey, bindings);
   }
   else if (rel.type === $.RelationType.derived) {
      return $.derived.makeProjection(rel, recKey, bindings);
   }
   else {
      throw new Error(`Cannot make projection of a relation of type '${rel.type}'`);
   }
}
projectionFor ::= function (rel, recKey, bindings) {
   $.check(recKey === undefined || $.recKeyBindingMakesSenseFor(rel), () =>
      `Binding rec key does not make sense for the relation '${rel.name}'`
   );

   let map = rel.projections;

   for (let [key, isFinal] of
         $.trackingFinal($.genProjectionKey(rel, recKey, bindings))) {
      if (map.has(key)) {
         map = map.get(key);
      }
      else {
         let next;

         if (isFinal) {
            next = {
               parent: map,
               key: key,
               proj: $.makeProjection(rel, recKey, bindings)
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
genProjectionKey ::= function* (rel, recKey, bindings) {
   if ($.recKeyBindingMakesSenseFor(rel)) {
      yield recKey;
   }

   for (let attr of rel.attrs) {
      yield bindings[attr];
   }
}
freeProjection ::= function (proj) {
   let {rel} = proj;

   if (rel.type === $.RelationType.base) {
      $.base.freeProjection(proj);
   }
   else if (rel.type === $.RelationType.derived) {
      $.derived.freeProjection(proj);
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

   let {rel} = proj;

   if (rel.type === $.RelationType.base) {
      $.base.updateProjection(proj);
   }
   else if (rel.type === $.RelationType.derived) {
      $.derived.updateProjection(proj);
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
