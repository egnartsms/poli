common
   assert
   check
   isA
dedb-base
   clsBaseRelation
   clsRecKeyBoundProjection
   clsUniqueHitProjection
   clsHitProjection
   clsNoHitProjection
   clsFullProjection
dedb-derived
   clsDerivedProjection
set-map
   deleteIntersection
   greaterLesser
   addAll
   setAll
-----
refCurrentState ::= function (owner) {
   if (owner.class === $.clsBaseRelation ||
         owner.class === $.clsHitProjection ||
         owner.class === $.clsNoHitProjection ||
         owner.class === $.clsDerivedProjection) {
      return $.refMultiVersion(owner);
   }

   if (owner.class === $.clsRecKeyBoundProjection) {
      return $.makeRecValVersion(owner);
   }

   if (owner.class === $.clsUniqueHitProjection) {
      return $.makeRecVersion(owner);
   }

   if (owner.class === $.clsFullProjection) {
      return $.refFullProjectionVersion(owner);
   }

   throw new Error;
}
refCurrentExtState ::= function (owner) {
   if (!owner.isKeyed) {
      return $.refCurrentState(owner);
   }

   if (owner.class === $.clsBaseRelation ||
         owner.class === $.clsHitProjection ||
         owner.class === $.clsNoHitProjection ||
         owner.class === $.clsDerivedProjection) {
      return $.refMultiExtVersion(owner);
   }

   if (owner.class === $.clsRecKeyBoundProjection) {
      return $.makeRecValVersion(owner);
   }

   if (owner.class === $.clsUniqueHitProjection) {
      return $.makeRecVersion(owner);
   }

   if (owner.class === $.clsFullProjection) {
      return $.refFullProjectionVersion(owner);
   }

   throw new Error;
}
clsVersion ::= ({
   name: 'version',
   'version': true
})
clsRecVersion ::= ({
   name: 'version.rec',
   'version.rec': true,
   'version': true
})
makeRecVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsUniqueHitProjection);

   return {
      class: $.clsRecVersion,
      proj: proj,
      rec: proj.rec
   }
}
clsRecValVersion ::= ({
   name: 'version.recval',
   'version.recval': true,
   'version': true
})
makeRecValVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsRecKeyBoundProjection);

   return {
      class: $.clsRecValVersion,
      proj: proj,
      rval: proj.rval
   }
}
refFullProjectionVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsFullProjection);

   return $.refCurrentState(proj.relation);
}
clsMultiVersion ::= ({
   name: 'version.multi',
   'version.multi': true,
   'version': true
})
refMultiVersion ::= function (owner) {
   $.ensureTopmostFresh(owner);

   owner.myVer.refCount += 1;

   return owner.myVer;
}
refMultiExtVersion ::= function (owner) {
   $.ensureTopmostFresh(owner);

   if (!$.isVersionExtended(owner.myVer)) {
      owner.myVer.removed = new Map;
   }

   owner.myVer.refCount += 1;
   owner.myVer.extCount += 1;
   owner.myVer.extTotal += 1;

   return owner.myVer;
}
ensureTopmostFresh ::= function (owner) {
   let prev = owner.myVer;
   
   if (prev !== null && $.isVersionFresh(prev)) {
      return;
   }

   let ver;

   if (owner.isKeyed) {
      let initiallyExtended = prev !== null && $.isVersionExtended(prev);

      ver = {
         class: $.clsMultiVersion,
         owner,
         num: 1 + (prev === null ? 0 : prev.num),
         refCount: prev === null ? 0 : 1,
         extCount: 0,
         extTotal: prev === null ? 0 : prev.extTotal,
         added: new Set,
         removed: new (initiallyExtended ? Map : Set),
         next: null,
      };
   }
   else {
      ver = {
         class: $.clsMultiVersion,
         owner,
         num: 1 + (prev === null ? 0 : prev.num),
         refCount: prev === null ? 0 : 1,
         added: new Set,
         removed: new Set,
         next: null,
      };
   }

   if (prev !== null) {
      prev.next = ver;
   }

   owner.myVer = ver;
}
isVersionFresh ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
}
isVersionExtended ::= function (ver) {
   return ver.extTotal > 0;
}
releaseVersion ::= function (ver) {
   $.assert(
      () => ver.refCount > 0 && (!ver.owner.isKeyed || ver.extCount < ver.refCount)
   );

   ver.refCount -= 1;

   while (ver.refCount === 0 && ver.next !== null) {
      ver = ver.next;
      ver.refCount -= 1;
   }

   if (ver.refCount === 0) {
      $.assert(() => ver.owner.myVer === ver);
      ver.owner.myVer = null;
   }
}
releaseExtVersion ::= function (ver) {
   if (!ver.owner.isKeyed) {
      $.releaseVersion(ver);
      return;
   }

   $.assert(() => ver.refCount > 0 && ver.extCount > 0);

   ver.refCount -= 1;
   ver.extCount -= 1;

   while (ver !== null) {
      ver.extTotal -= 1;

      if (ver.refCount === 0) {
         if (ver.next === null) {
            $.assert(() => ver.owner.myVer === ver);
            ver.owner.myVer = null;
         }
         else {
            ver.next.refCount -= 1;
         }
      }
      else if (ver.extTotal === 0) {
         // Transition to a non-extended version
         ver.removed = new Set(ver.removed.keys());
      }

      ver = ver.next;
   }
}
unchainVersion ::= function (ver) {
   if (ver.next === null) {
      return;
   }

   let owner = ver.owner;

   $.ensureTopmostFresh(owner);

   let topmost = owner.myVer;
   let chain = [];

   while (ver.next !== topmost) {
      chain.push(ver);
      ver = ver.next;
   }

   chain.reverse();

   let proc = owner.isKeyed ? $.unchain1keyed : $.unchain1tupled;

   for (let ver of chain) {
      let next = ver.next;

      proc(ver);

      ver.next = topmost;
      topmost.refCount += 1;
      $.releaseVersion(next);

      if (next.refCount > 0 && owner.isKeyed && $.isVersionExtended(next)) {
         next.extTotal -= ver.extTotal;

         if (next.extTotal === 0) {
            next.removed = new Set(next.removed.keys());
         }
      }
   }
}
unchain1tupled ::= function (ver) {
   let next = ver.next;
   let isNextDone = next.refCount === 1;

   if (isNextDone) {
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
      $.setSplitMerge(next.added, ver.removed, ver.added);
      $.setSplitMerge(next.removed, ver.added, ver.removed);
   }
}
unchain1keyed ::= function (ver) {
   let next = ver.next;
   let isExtended = $.isVersionExtended(ver);
   let isNextDone = next.refCount === 1;

   if (isNextDone) {
      $.assert(() => $.isVersionExtended(next) === isExtended);

      $.deleteIntersection(ver.added, next.removed);

      let [ga, la] = $.greaterLesser(ver.added, next.added);
      let [gr, lr] = $.greaterLesser(ver.removed, next.removed);

      $.addAll(ga, la);

      (isExtended ? $.setAll : $.addAll)(gr, lr);

      ver.added = ga;
      ver.removed = gr;

      next.added = null;
      next.removed = null;
   }
   else {
      $.setAll(ver.added, next.added);

      if (isExtended) {
         $.mapSplitMerge(next.removed, ver.added, ver.removed);
      }
      else {
         // Here, next.removed may be either Set or Map (next can be extended or not)
         $.setSplitMerge(next.removed.keys(), ver.added, ver.removed);
      }
   }
}
setSplitMerge ::= function (source, toRemove, toAdd) {
   for (let x of source) {
      if (toRemove.has(x)) {
         toRemove.delete(x);
      }
      else {
         toAdd.add(x);
      }
   }
}
mapSplitMerge ::= function (source, toRemove, toAdd) {
   for (let [key, val] of source) {
      if (toRemove.has(key)) {
         toRemove.delete(key);
      }
      else {
         toAdd.set(key, val);
      }
   }
}
versionAddKey ::= function (ver, rkey) {
   $.assert(() => ver.class === $.clsMultiVersion);

   if (ver.owner.isKeyed) {
      ver.added.add(rkey);
   }
   else {
      if (ver.removed.has(rkey)) {
         ver.removed.delete(rkey);
      }
      else {
         ver.added.add(rkey);
      }
   }
}
versionRemove ::= function (ver, rec) {
   $.assert(() => ver.class === $.clsMultiVersion);

   if (ver.owner.isKeyed) {
      let [rkey, rval] = rec;

      if (ver.added.has(rkey)) {
         ver.added.delete(rkey);
      }
      else if ($.isVersionExtended(ver)) {
         ver.removed.set(rkey, rval);
      }
      else {
         ver.removed.add(rkey);
      }
   }
   else {
      if (ver.added.has(rec)) {
         ver.added.delete(rec);
      }
      else {
         ver.removed.add(rec);
      }
   }
}
