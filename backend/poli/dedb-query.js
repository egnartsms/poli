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
   tupleFitnessByBindings
   findSuitableIndex
   refIndex
dedb-index-instance
   indexRefWithBindings
dedb-derived
   makeProjection as: makeDerivedProjection

-----

time ::= 0
indexCache ::= new Map
recencyHead ::= null

dumpRecencyList ::=
   function () {
      console.log('Q time:', $.time);
      console.log('Q rec list:', $.recencyHead);
      console.log('Q proj cache:', $.derivedProjectionCache);
   }


getIndex ::=
   function (rel, hardBindings, softBindings) {
      if (rel.kind === 'base') {
         $.check(arguments.length === 2);

         let idx = $.refIndex(hardBindings);
         let rec = $.indexCache.get(idx);

         if (rec === undefined) {
            rec = {
               index: idx,
               lastUsed: 0,
               prev: null,
               next: null,
            };
            $.indexCache.set(idx, rec);
         }
         else {
            idx.refCount -= 1;
         }

         $.time += 1;
         $.setAsNewHead(rec);
      }

      throw new Error(`Not impl`);
   }


lookupDerivedProjection ::=
   function (rel, bindings) {
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

setAsNewHead ::=
   function (rec) {
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

clearProjectionCache ::=
   function () {
      throw new Error(`Not impl`);
      for (let proj of $.derivedProjectionCache.keys()) {
         $.releaseProjection(proj);
      }
      
      $.derivedProjectionCache.clear();
      $.recencyHead = null;
   }
