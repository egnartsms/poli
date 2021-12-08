common
   assert
   check
   isA
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-relation
   getRelation
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
recencyList ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyList);
   console.log('Q proj cache:', $.derivedProjectionCache);
}
valueAtKey ::= function (relInfo, recKey) {
   let rel = $.getRelation(relInfo);

   $.check(rel.isKeyed);

   return rel.records.valueAt(recKey);
}
queryUniqueRecord ::= function (relInfo, bindings) {
   let rel = $.getRelation(relInfo);
      
   if (rel.class === $.clsBaseRelation) {
      return $.getUniqueRecord(rel, bindings);
   }

   if (rel.class === $.clsDerivedRelation) {
      $.check(Object.keys(bindings).length === 0);

      let proj = $.lookupDerivedProjection(rel, undefined, bindings);
      let [rec] = proj.records;

      return rec;
   }
   
   throw new Error;
}
queryRecords ::= function (relInfo, bindings) {
   let rel = $.getRelation(relInfo);
   
   if (rel.class === $.clsBaseRelation) {
      return $.getRecords(rel, bindings);
   }
   
   if (rel.class === $.clsDerivedRelation) {
      $.check(Object.keys(bindings).length === 0);

      let proj = $.lookupDerivedProjection(rel, undefined, bindings);

      return proj.records;
   }

   throw new Error;
}
lookupDerivedProjection ::= function (rel, rkey, bindings) {
   $.assert(() => rel.class === $.clsDerivedRelation);

   let proj = $.projectionFor(rel, rkey, bindings);
   let rec = $.derivedProjectionCache.get(proj);

   if (rec === undefined) {
      proj.refCount += 1;
      rec = {
         prev: null,
         next: null,
         proj: proj,
         lastUsed: 0
      };
      $.derivedProjectionCache.set(proj, rec);
   }

   $.time += 1;
   $.setAsNewHead(rec);

   $.updateProjection(proj);

   return proj;
}
setAsNewHead ::= function (rec) {
   if ($.recencyList !== null && $.recencyList !== rec) {
      if (rec.prev !== null) {
         rec.prev.next = rec.next;
      }
      if (rec.next !== null) {
         rec.next.prev = rec.prev;
      }
      rec.prev = null;
      rec.next = $.recencyList;
      $.recencyList.prev = rec;
   }

   $.recencyList = rec;
   $.recencyList.lastUsed = $.time;
}
clearProjectionCache ::= function () {
   for (let proj of $.derivedProjectionCache.keys()) {
      $.releaseProjection(proj);
   }
   
   $.derivedProjectionCache.clear();
   $.recencyList = null;
}
