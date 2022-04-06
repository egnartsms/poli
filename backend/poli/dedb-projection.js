common
   assert
   check
   hasOwnProperty
   trackingFinal
   filter
   greatestBy
   isA
dedb-base
   * as: base
dedb-derived
   * as: derived
dedb-aggregate
   * as: agg
dedb-query
   suitsFilterBy
   computeFilterBy
dedb-index
   indexFitnessByBindings
dedb-index-instance
   indexRefWithBindings
-----
makeProjectionRegistry ::= function () {
   return Object.assign(new Map, {
      parent: null
   });
}
makeProjection ::= function (rel, bindings) {
   if (rel.kind === 'base') {
      return $.base.makeProjection(rel, bindings);
   }
   else if (rel.kind === 'derived') {
      return $.derived.makeProjection(rel, bindings);
   }
   else if (rel.kind === 'aggregate') {
      return $.agg.makeProjection(rel, bindings);
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
   for (let attr of rel.attrs) {
      yield $.hasOwnProperty(bindings, attr) ? bindings[attr] : undefined;
   }
}
freeProjection ::= function (proj) {
   let {rel} = proj;

   if (rel.kind === 'base') {
      $.base.freeProjection(proj);
   }
   else if (rel.kind === 'derived') {
      $.derived.freeProjection(proj);
   }
   else if (rel.kind === 'aggregate') {
      $.agg.freeProjection(proj);
   }
   else {
      throw new Error;
   }
}
invalidateProjection ::= function (root) {
   if (!root.isValid) {
      return;
   }

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

   let {rel} = proj;

   if (rel.kind === 'base') {
      $.base.updateProjection(proj);
   }
   else if (rel.kind === 'derived') {
      $.derived.updateProjection(proj);
   }
   else if (rel.kind === 'aggregate') {
      $.agg.updateProjection(proj);
   }
   else {
      throw new Error;
   }
}
referentialSize ::= function (proj) {
   if (proj.kind === 'unique-hit' || proj.kind === 'aggregate-0-dim') {
      return 1;
   }

   if (proj.kind === 'derived') {
      return proj.records.size;
   }

   if (proj.kind === 'aggregate') {
      return proj.size;
   }

   if (proj.kind === 'partial' || proj.kind === 'full') {
      return proj.rel.records.size;
   }

   throw new Error;
}
projectionRecords ::= function (proj) {
   if (proj.kind === 'derived') {
      return proj.records;
   }

   if (proj.kind === 'aggregate') {
      let [group2agg] = proj.Agroup2agg;
      
      return group2agg.keys();
   }

   if (proj.kind === 'full') {
      return proj.rel.records;
   }

   if (proj.kind === 'unique-hit') {
      return proj.rec === undefined ? [] : [proj.rec];
   }

   if (proj.kind === 'partial') {
      return $.filter(proj.rel.records, rec => $.suitsFilterBy(rec, proj.filterBy));
   }

   throw new Error;   
}
