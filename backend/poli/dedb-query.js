common
   check
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
dedb-relation
   getRelation
   RelationType
dedb-base
   getUniqueRecord
-----
time ::= 0
projectionCache ::= new Map
recencyList ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyList);
   console.log('Q proj cache:', $.projectionCache);
}
valueAtKey ::= function (relInfo, recKey) {
   let rel = $.getRelation(relInfo);

   $.check(rel.isKeyed);

   return rel.records.get(recKey);
}
queryUniqueRecord ::= function (relInfo, bindings) {
   let rel = $.getRelation(relInfo);
      
   if (rel.type !== $.RelationType.base) {
      throw new Error;
   }

   return $.getUniqueRecord(rel, bindings);
}
query ::= function (relInfo, boundAttrs) {
   let rel = $.getRelation(relInfo);
   
   if (rel.type === $.RelationType.base) {
      return $.queryBaseRelation(rel, boundAttrs);
   }

   throw new Error;
   
   let proj = $.projectionFor(rel, boundAttrs);
   let rec = $.projectionCache.get(proj);

   if (rec === undefined) {
      proj.refCount += 1;
      rec = {
         prev: null,
         next: null,
         proj: proj,
         lastUsed: 0
      };
      $.projectionCache.set(proj, rec);
   }

   $.time += 1;
   $.setAsNewHead(rec);

   $.updateProjection(proj);

   return proj.getRecords();
}
queryBaseRelation ::= function (rel, boundAttrs) {

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
   for (let proj of $.projectionCache.keys()) {
      $.releaseProjection(proj);
   }
   
   $.projectionCache.clear();
   $.recencyList = null;
}
