common
   assert
   check
   isA
   isIterableEmpty
set-map
   deleteIntersection
   greaterLesser
   addAll
   setAll
dedb-projection
   projectionRecords
-----

refRelationState ::=
   function (rel) {
      $.assert(() => rel.kind === 'base');

      $.ensureTopmostFresh(rel, rel.protoEntity !== null);
      rel.myVer.refCount += 1;

      return rel.myVer;
   }


refProjectionState ::=
   function (proj) {
      if (proj.kind === 'derived' || proj.kind === 'aggregate') {
         $.ensureTopmostFresh(proj, proj.rel.protoEntity !== null);
         proj.myVer.refCount += 1;

         return proj.myVer;
      }

      if (proj.kind === 'partial') {
         if (proj.depVer === null) {
            proj.depVer = $.refRelationState(proj.rel);
         }

         $.ensureTopmostFresh(proj, proj.rel.protoEntity !== null);
         proj.myVer.refCount += 1;

         return proj.myVer;
      }

      if (['unique-hit', 'aggregate-0-dim', 'entity'].includes(proj.kind)) {
         return $.makeScalarVersion(proj);
      }

      if (proj.kind === 'full') {
         return $.refRelationState(proj.rel);
      }

      throw new Error;
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


ensureTopmostFresh ::=
   function (versionable, isEntityBased) {
      let prev = versionable.myVer;

      if (prev !== null && $.isMultiVersionFresh(prev)) {
         return;
      }

      let ver = {
         kind: 'multi',
         owner: versionable,
         isEntityBased,
         num: 1 + (prev === null ? 0 : prev.num),
         refCount: prev === null ? 0 : 1,
         changes: isEntityBased ? {
            added: new Map,
            removed: new Map
         } : {
            added: new Set,
            removed: new Set
         },
         next: null,
      };

      if (prev !== null) {
         prev.next = ver;
      }

      versionable.myVer = ver;
   }


isMultiVersionFresh ::=
   function (ver) {
      let {added, removed} = ver.changes;

      return added.size === 0 && removed.size === 0;
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
   function (ver) {
      if (ver.kind !== 'multi') {
         return;
      }

      if (ver.next === null) {
         return;
      }

      let owner = ver.owner;

      $.ensureTopmostFresh(owner, ver.isEntityBased);

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
            $.versionAddAll(next.added, ver);
            $.versionRemoveAll(next.removed, ver);
         }

         ver.next = topmost;
         topmost.refCount += 1;
         $.releaseVersion(next);
      }
   }


isVersionPristine ::=
   function (ver) {
      if (ver.kind === 'scalar') {
         return ver.rec === vec.proj.rec
      }

      if (ver.kind === 'multi') {
         return $.isMultiVersionFresh(ver);
      }

      throw new Error;
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


versionAddAll ::=
   function (vec, recs) {
      for (let rec of recs) {
         $.versionAdd(ver, rec);
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


versionRemoveAll ::=
   function (ver, rec) {
      for (let rec of recs) {
         $.versionRemove(ver, rec);
      }
   }


versionAddedRecords ::=
   function (ver) {
      if (ver.kind === 'scalar') {
         let {proj} = ver;

         if (ver.rec !== proj.rec && proj.rec !== null) {
            return [proj.rec];
         }
         else {
            return [];
         }
      }

      if (ver.kind === 'multi') {
         return ver.added;
      }

      if (ver.kind === 'zero') {
         return $.projectionRecords(ver.owner);
      }

      throw new Error;
   }


versionRemovedRecords ::=
   function (ver) {
      if (ver.kind === 'scalar') {
         let {proj} = ver;

         if (proj.rec !== ver.rec && ver.rec !== null) {
            return [ver.rec];
         }
         else {
            return [];
         }
      }

      if (ver.kind === 'multi') {
         return ver.removed;
      }

      if (ver.kind === 'zero') {
         return [];
      }

      throw new Error;
   }
