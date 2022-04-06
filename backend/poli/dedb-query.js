common
   assert
   check
   isA
   hasOwnProperty
   filter
   greatestBy
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-base
   idty
dedb-index
   Fitness
   indexFitnessByBindings
dedb-index-instance
   indexRefWithBindings
dedb-derived
   makeProjection as: makeDerivedProjection
-----
getRecords ::= function (insts, bindings) {
   let [inst, fitness] = $.findSuitableIdxInst(insts, bindings);

   $.check(fitness !== $.Fitness.minimum, `Could not find suitable index`);

   let recs = $.indexRefWithBindings(inst, bindings);
   let filterBy = $.computeFilterBy(bindings, inst.index);

   return (filterBy.length === 0) ? recs :
      $.filter(recs, rec => $.suitsFilterBy(rec, filterBy));
}
findSuitableIdxInst ::= function (insts, bindings) {
   return $.greatestBy(
      insts,
      ({index}) => $.indexFitnessByBindings(index, bindings)
   );
}
computeFilterBy ::= function (bindings, exceptAttrs=[]) {
   return Object.entries(bindings).filter(([attr, val]) => !exceptAttrs.includes(attr));
}
suitsFilterBy ::= function (rec, filterBy) {
   for (let [attr, val] of filterBy) {
      if (rec[attr] !== val) {
         return false;
      }
   }

   return true;
}
time ::= 0
derivedProjectionCache ::= new Map
recencyHead ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyHead);
   console.log('Q proj cache:', $.derivedProjectionCache);
}
query ::= function (rel, hardBindings, softBindings) {
   if (rel.kind === 'base') {
      $.check(softBindings === undefined);

      softBindings = hardBindings;

      return softBindings == null ? rel.records :
         $.getRecords(rel.myInsts, softBindings);
   }

   if (rel.kind === 'derived') {
      let proj = $.lookupDerivedProjection(rel, hardBindings);

      return softBindings === undefined ? proj.records :
         $.getRecords(proj.myInsts, softBindings);
   }

   throw new Error;
}
queryAtMostOne ::= function (rel, hardBindings, softBindings) {
   if (rel.kind === 'aggregate') {
      let proj = $.lookupDerivedProjection(rel, hardBindings);
      
      if (proj.kind === 'aggregate-0-dim') {
         $.check(softBindings === undefined);
         return proj.rec;
      }

      $.assert(() => proj.kind === 'aggregate');

      let group = proj.recordMap;

      for (let key of proj.groupBy) {
         group = group.get(softBindings[key]);

         if (group === undefined) {
            return null;
         }
      }

      return group;
   }

   let [rec] = $.query(rel, hardBindings, softBindings);
   return rec ?? null;
}
queryOne ::= function (rel, hardBindings, softBindings) {
   let rec = $.queryAtMostOne(rel, hardBindings, softBindings);
   $.check(rec !== null);
   return rec;
}
queryEntity ::= function (rel, bindings) {
   let [rec] = $.getRecords(rel.myInsts, bindings);
   return rec[$.idty];
}
lookupDerivedProjection ::= function (rel, bindings) {
   $.assert(() => rel.kind === 'derived' || rel.kind === 'aggregate');

   let proj = $.projectionFor(rel, bindings);
   let rec = $.derivedProjectionCache.get(proj);

   if (rec === undefined) {
      proj.refCount += 1;
      rec = {
         proj: proj,
         lastUsed: 0,
         prev: null,
         next: null,
      };
      $.derivedProjectionCache.set(proj, rec);
   }

   $.time += 1;
   $.setAsNewHead(rec);

   $.updateProjection(proj);

   return proj;
}
setAsNewHead ::= function (rec) {
   if ($.recencyHead !== null && $.recencyHead !== rec) {
      if (rec.prev !== null) {
         rec.prev.next = rec.next;
      }
      if (rec.next !== null) {
         rec.next.prev = rec.prev;
      }
      rec.prev = null;
      rec.next = $.recencyHead;
      $.recencyHead.prev = rec;
   }

   $.recencyHead = rec;
   $.recencyHead.lastUsed = $.time;
}
clearProjectionCache ::= function () {
   for (let proj of $.derivedProjectionCache.keys()) {
      $.releaseProjection(proj);
   }
   
   $.derivedProjectionCache.clear();
   $.recencyHead = null;
}
