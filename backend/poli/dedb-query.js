common
   check
dedb-projection
   projectionFor
   releaseProjection
   updateProjection
-----
time ::= 0
projectionCache ::= new Map
recencyList ::= null
dumpRecencyList ::= function () {
   console.log('Q time:', $.time);
   console.log('Q rec list:', $.recencyList);
   console.log('Q proj cache:', $.projectionCache);
}
queryScalarKey ::= function (rel, boundAttrs) {
   let records = $.query(rel, boundAttrs);

   if (records.size === 1) {
      let [[rkey, rval]] = records;

      return rkey;
   }
   else if (records.size === 0) {
      return undefined;
   }
   else {
      throw new Error(`Not a scalar`);
   }
}
query ::= function (rel, boundAttrs) {
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

   return proj.records;
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
