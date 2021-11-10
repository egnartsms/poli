common
   assert
   check
   hasOwnProperty
   trackingFinal
dedb-relation
   RelationType
dedb-base
   * as: base
dedb-derived
   * as: derived
dedb-rec-key
   recVal
-----
makeProjection ::= function (rel, boundAttrs) {
   if (rel.type === $.RelationType.base) {
      return $.base.makeProjection(rel, boundAttrs);
   }
   else if (rel.type === $.RelationType.derived) {
      return $.derived.makeProjection(rel, boundAttrs);
   }
   else {
      throw new Error(`Cannot make projection of a relation of type '${rel.type}'`);
   }
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
attrFree ::= Symbol('poli.free-attr')
projmapKey ::= function (boundAttrs, attr) {
   return $.hasOwnProperty(boundAttrs, attr) ? boundAttrs[attr] : $.attrFree;
}
releaseProjection ::= function (proj) {
   $.check(proj.refCount > 0);

   proj.refCount -= 1;

   if (proj.refCount === 0) {
      // By the time a projection's refCount drops to 0, nobody must be using it
      // (otherwise the refCount would not have dropped to 0).
      $.assert(() => proj.myVer === null);
      // Index instances should've been released before the projection itself
      $.assert(() => proj.myIndexInstances.totalRefs === 0);

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
