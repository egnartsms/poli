common
   assert
   check
   isA
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-base
   getUniqueRecord
   getRecords
dedb-derived
   makeProjection as: makeDerivedProjection
-----
time ::= 0
derivedProjectionCache ::= new Map
recencyHead ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyHead);
   console.log('Q proj cache:', $.derivedProjectionCache);
}
valueAt ::= function (rel, recKey) {
   $.check(rel.isKeyed);

   if (rel.kind === 'base') {
      return rel.records.valueAt(recKey);
   }

   if (rel.kind === 'derived') {
      let fullProj = $.lookupDerivedProjection(rel, {});

      return fullProj.records.valueAt(recKey);
   }

   throw new Error;
}
query1 ::= function (rel, bindings) {
   if (rel.kind === 'base') {
      return $.getUniqueRecord(rel, bindings);
   }

   if (rel.kind === 'derived') {
      let proj = $.lookupDerivedProjection(rel, bindings);

      $.check(proj.records.size <= 1);

      let [rec] = proj.records;

      return rec;
   }
   
   throw new Error;
}
query ::= function (rel, bindings) {
   if (rel.kind === 'base') {
      return $.getRecords(rel, bindings);
   }

   if (rel.kind === 'derived') {
      let proj = $.lookupDerivedProjection(rel, bindings);

      return proj.records;
   }

   throw new Error;
}
lookupDerivedProjection ::= function (rel, bindings) {
   $.assert(() => rel.kind === 'derived');

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
