common
   assert
prolog-fact
   projectionFor
   releaseProjection
   updateProjection
-----
time ::= 0
projectionCache ::= new Map
recencyList ::= null
query ::= function (rel, boundAttrs) {
   $.assert(rel.isFactual);

   let proj = $.projectionFor(rel, boundAttrs);
   let rec = $.projectionCache.get(proj);

   if (rec === undefined) {
      proj.refcount += 1;
      rec = {
         prev: null,
         next: null,
         proj: proj,
         lastUsed: 0
      };
      $.projectionCache.set(proj, rec);
   }

   $.setAsNewHead(rec);
   $.time += 1;

   $.updateProjection(proj);

   return proj.value;
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
