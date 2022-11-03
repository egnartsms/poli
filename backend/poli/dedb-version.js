common
   assert
   check
   isA
   isIterableEmpty
   noUndefinedProps
set-map
   deleteIntersection
   greaterLesser
   addAll
   setAll
dedb-projection
   projectionRecords
   tagProjection
dedb-base
   * as: base
dedb-derived
   * as: derived
dedb-tag
   tag
   recur

-----

versionTaggables ::=
   function* (ver) {
      yield ver;
      yield ver.proj;
   }


---------------------------------------------
Everything below is the old code

refProjectionVersion ::=
   function (rel, bindings) {
      bindings = $.noUndefinedProps(bindings);

      if (rel.kind === 'base') {
         return $.base.refProjectionVersion(rel, bindings);
      }
      else if (rel.kind === 'derived') {
         return $.derived.refProjectionVersion(rel, bindings);
      }
      else {
         throw new Error(`Unexpected rel type: '${rel.name}'`);
      }
   }


releaseVersion ::=
   function (ver) {
      if (ver.proj.rel.kind === 'base') {
         return $.base.releaseVersion(ver);
      }
      else if (ver.proj.rel.kind === 'derived') {
         return $.derived.releaseVersion(ver);
      }
      else {
         throw new Error(`Unexpected rel type: '${ver.proj.rel.name}'`);
      }
   }


refState ::=
   function (proj) {
      if (proj.rel.kind === 'base') {
         $.ensureTopmostPristine(proj);
         proj.ver.refCount += 1;

         return proj.ver;
      }

      throw new Error(`Not impl`);
   }


isPristine ::=
   function (ver) {
      return ver.added.size === 0 && ver.removed.size === 0;
   }


makeScalarVersion ::=
   function (proj) {
      return {
         kind: 'scalar',
         proj: proj,
         rec: proj.rec,
      }
   }


makeZeroVersion ::=
   function (owner) {
      // Zero versions are used for aggregate relations. For derived relations they are not
      // used yet. They will be needed when/if you implement the combined full + partial
      // derived projection computation algorithm
      return {
         kind: 'zero',
         owner
      }
   }


releaseVersion ::=
   function (ver) {
      if (ver.kind !== 'multi') {
         return;
      }

      $.assert(() => ver.refCount > 0);

      ver.refCount -= 1;

      while (ver.refCount === 0 && ver.next !== null) {
         ver = ver.next;
         ver.refCount -= 1;
      }

      if (ver.refCount === 0) {
         let {owner} = ver;

         $.assert(() => owner.myVer === ver);

         owner.myVer = null;

         if (owner.kind === 'partial') {
            $.assert(() => owner.depVer !== null);
            
            $.releaseVersion(owner.depVer);
            owner.depVer = null;
         }
      }
   }


prepareVersion ::=
   :For 'multi' kind of version, unchain it. For others, do nothing.

   function (ver) {
      if (ver.kind !== 'multi') {
         return;
      }

      if (ver.next === null) {
         return;
      }

      let owner = ver.owner;

      $.ensureTopmostPristine(owner, ver.added.constructor);

      let topmost = owner.myVer;
      let chain = [];

      while (ver.next !== topmost) {
         chain.push(ver);
         ver = ver.next;
      }

      chain.reverse();

      for (let ver of chain) {
         let next = ver.next;

         if (next.refCount === 1) {
            $.deleteIntersection(ver.added, next.removed);
            $.deleteIntersection(ver.removed, next.added);

            let [ga, la] = $.greaterLesser(ver.added, next.added);
            let [gr, lr] = $.greaterLesser(ver.removed, next.removed);

            $.addAll(ga, la);
            $.addAll(gr, lr);

            ver.added = ga;
            ver.removed = gr;

            next.added = null;
            next.removed = null;
         }
         else {
            $.versionAddAll(ver, next.added);
            $.versionRemoveAll(ver, next.removed);
         }

         ver.next = topmost;
         topmost.refCount += 1;
         $.releaseVersion(next);
      }
   }


versionAdd ::=
   function (ver, rec) {
      if (ver.removed.has(rec)) {
         ver.removed.delete(rec);
      }
      else {
         ver.added.add(rec);
      }
   }


versionRemove ::=
   function (ver, rec) {
      if (ver.added.has(rec)) {
         ver.added.delete(rec);
      }
      else {
         ver.removed.add(rec);
      }
   }


versionAddAll ::=
   function (ver, recs) {
      for (let rec of recs) {
         $.versionAdd(ver, rec);
      }
   }


versionRemoveAll ::=
   function (ver, rec) {
      for (let rec of recs) {
         $.versionRemove(ver, rec);
      }
   }


versionAddedRecords ::=
   :Return the set of records added since `ver` capture time.

    The version should be prepared (see `prepareVersion`) if it's a 'multi' version.

    `relevantAttrs` is an array of attributes we're interested in (if they changed).
    This currently makes sense only for entity-based projections.

   function (ver, relevantAttrs=null) {
      if (ver.kind === 'scalar') {
         let {proj} = ver;
         let recA = proj.rec;
         let recR = ver.rec;

         if (ver.rec !== proj.rec && proj.rec !== null) {
            // TODO: continue here
         }
         return new Set(
            (ver.rec !== proj.rec && proj.rec !== null) ? [proj.rec] : []
         );
      }

      if (ver.kind === 'multi') {
         if (relevantAttrs === null) {
            return ver.added;
         }

         $.check(ver.added.constructor === $.EntitySet);
         let result = new Set;

         for (let recA of ver.added) {
            let entity = recA[$.entity];
            let recR = ver.removed.recordFor(entity);

            if (recR === null) {
               result.add(recA);
            }
            else if ($.any($.relevantAttrs, attr => recA[attr] !== recR[attr])) {
               result.add(recA);
            }
         }

         return result;
      }

      if (ver.kind === 'zero') {
         return new Set($.projectionRecords(ver.owner));
      }

      throw new Error;
   }


versionRemovedRecords ::=
   :Return the iterable of records removed since `ver` capture time.

    The version should be prepared (see `prepareVersion`) if it's a 'multi' version.

    `relevantAttrs` is an array of attributes we're interested in (if they changed).
    This currently makes sense only for entity-based projections.

   function (ver, relevantAttrs=null) {
      if (ver.kind === 'scalar') {
         let {proj} = ver;

         return (ver.rec !== proj.rec && ver.rec !== null) ? [ver.rec] : [];
      }

      if (ver.kind === 'multi') {
         if (relevantAttrs === null) {
            return ver.removed;
         }

         $.assert(() => ver.removed.constructor === $.EntitySet);
         
         return (function* () {
            for (let recR of ver.removed) {
               let entity = recR[$.entity];
               let recA = ver.added.recordFor(entity);

               if (recA === null) {
                  yield recR;
               }
               else if ($.any($.relevantAttrs, attr => recR[attr] !== recA[attr])) {
                  yield recR;
               }
            }
         }());
      }

      if (ver.kind === 'zero') {
         return [];
      }

      throw new Error;
   }
