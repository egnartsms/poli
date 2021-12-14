common
   assert
   check
   isA
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-relation
   toRelation
dedb-base
   getUniqueRecord
   getRecords
   clsBaseRelation
dedb-derived
   makeProjection as: makeDerivedProjection
   clsDerivedRelation
-----
time ::= 0
derivedProjectionCache ::= new Map
recencyHead ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyHead);
   console.log('Q proj cache:', $.derivedProjectionCache);
}
valueAt ::= function (relInfo, recKey) {
   let rel = $.toRelation(relInfo);

   $.check(rel.isKeyed);

   if (rel.class === $.clsBaseRelation) {
      return rel.records.valueAt(recKey);
   }

   if (rel.class === $.clsDerivedRelation) {
      let fullProj = $.lookupDerivedProjection(rel, {});

      return fullProj.records.valueAt(recKey);
   }

   throw new Error;
}
queryOne ::= function (relInfo, bindings) {
   let rel = $.toRelation(relInfo);
      
   if (rel.class === $.clsBaseRelation) {
      return $.getUniqueRecord(rel, bindings);
   }

   if (rel.class === $.clsDerivedRelation) {
      let proj = $.lookupDerivedProjection(rel, bindings);
      
      $.check(proj.records.size <= 1);

      let [rec] = proj.records;

      return rec;
   }
   
   throw new Error;
}
query ::= function (relInfo, bindings) {
   let rel = $.toRelation(relInfo);

   if (rel.class === $.clsBaseRelation) {
      return $.getRecords(rel, bindings);
   }

   if (rel.class === $.clsDerivedRelation) {
      let proj = $.lookupDerivedProjection(rel, bindings);

      return proj.records;
   }

   throw new Error;
}
getDerivedProjection ::= function (relInfo, bindings) {
   let rel = $.toRelation(relInfo);

   $.check(rel.class === $.clsDerivedRelation);

   return $.lookupDerivedProjection(rel, bindings);
}
lookupDerivedProjection ::= function (rel, bindings) {
   $.assert(() => rel.class === $.clsDerivedRelation);

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
