common
   assert
   check
data-structures
   AugmentedMap
set-map
   deleteIntersection
   greaterLesser
   addAllToSet
   addAllToMap
dedb-common
   RecordType
-----
refCurrentState ::= function (parent) {
   // 'parent' is a base relation or projection (of either base or derived relation)
   // Full base projections are "transparent" i.e. they have no storage of their own
   // (they share storage with their relation).
   let owner = parent.records.owner;

   if (owner.myVer === null || !$.isVersionFresh(owner.myVer)) {
      $.installFreshVersion(owner);
   }
   
   owner.myVer.refCount += 1;

   return owner.myVer;
}
refCurrentStateExt ::= function (parent) {
   if (!parent.isKeyed) {
      return $.refCurrentState(parent);
   }

   let owner = parent.records.owner;

   if (owner.myVer === null || !$.isVersionFresh(owner.myVer)) {
      $.installFreshVersion(owner);
   }
   
   if (!$.isVersionExtended(owner.myVer)) {
      Object.assign(owner.myVer, {
         added: new $.AugmentedMap,
         removed: new $.AugmentedMap
      });
   }

   owner.myVer.refCount += 1;
   owner.myVer.extCount += 1;
   owner.myVer.extTotal += 1;

   return owner.myVer;
}
isVersionFresh ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
}
installFreshVersion ::= function (owner) {
   let prev = owner.myVer;
   let ver;

   if (owner.isKeyed) {
      let initiallyExtended = prev !== null && $.isVersionExtended(prev);

      ver = {
         owner,
         num: 1 + (prev === null ? 0 : prev.num),
         refCount: prev === null ? 0 : 1,
         extCount: 0,
         extTotal: prev === null ? 0 : prev.extTotal,
         next: null,
         added: initiallyExtended ? new $.AugmentedMap : new Set,
         removed: initiallyExtended ? new $.AugmentedMap : new Set,
      };
   }
   else {
      ver = {
         owner,
         num: 1 + (prev === null ? 0 : prev.num),
         refCount: prev === null ? 0 : 1,
         next: null,
         added: new Set,  // initialized below
         removed: new Set,   // initialized below
      };
   }

   if (prev !== null) {
      prev.next = ver;
   }

   owner.myVer = ver;
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
   ver.extTotal -= 1;

   while (ver.next !== null) {
      if (ver.refCount === 0) {
         ver.next.refCount -= 1;
      }
      else if (ver.extTotal === 0) {
         // Transition to a non-extended version
         ver.added = new Set(ver.added.keys());
         ver.removed = new Set(ver.removed.keys());
      }

      ver = ver.next;
      ver.extTotal -= 1;
   }

   if (ver.refCount === 0) {
      $.assert(() => ver.owner.myVer === ver);
      ver.owner.myVer = null;
   }
   else if (ver.extTotal === 0) {
      // Transition to a non-extended version
      ver.added = new Set(ver.added.keys());
      ver.removed = new Set(ver.removed.keys());
   }
}
ensureTopmostFresh ::= function (owner) {
   if (owner.myVer !== null && !$.isVersionFresh(owner.myVer)) {
      $.installFreshVersion(owner);
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

   let proc = owner.isKeyed ? $.unchain1keyed : $.unchain1tuple;

   for (let ver of chain) {
      let next = ver.next;

      proc(ver);

      ver.next = topmost;
      topmost.refCount += 1;
      $.releaseVersion(next);
   }
}
unchain1tuple ::= function (ver) {
   let next = ver.next;
   let isNextMutable = next.refCount === 1;

   if (isNextMutable) {
      $.deleteIntersection(ver.added, next.removed);
      $.deleteIntersection(ver.removed, next.added);

      let [ga, la] = $.greaterLesser(ver.added, next.added);
      let [gr, lr] = $.greaterLesser(ver.removed, next.removed);

      $.addAllToSet(ga, la);
      $.addAllToSet(gr, lr);

      ver.added = ga;
      ver.removed = gr;

      next.added = null;
      next.removed = null;
   }
   else {
      $.setRemoveAdd(next.added, ver.removed, ver.added);
      $.setRemoveAdd(next.removed, ver.added, ver.removed);
   }
}
unchain1keyed ::= function (ver) {
   let next = ver.next;
   let isExtended = $.isVersionExtended(ver);
   let isNextMutable = next.refCount === 1;

   if (isNextMutable) {
      $.deleteIntersection(ver.added, next.removed);

      let [ga, la] = $.greaterLesser(ver.added, next.added);
      let [gr, lr] = $.greaterLesser(ver.removed, next.removed);

      if (isExtended) {
         $.addAllToMap(ga, la);
         $.addAllToMap(gr, lr);
      }
      else {
         $.addAllToSet(ga, la);
         $.addAllToSet(gr, lr);
      }

      ver.added = ga;
      ver.removed = gr;

      next.added = null;
      next.removed = null;
   }
   else if (isExtended) {
      $.addAllToMap(ver.added, next.added);
      $.mapRemoveAdd(next.removed, ver.added, ver.removed);
   }
   else {
      $.addAllToSet(ver.added, next.added.keys());
      $.setRemoveAdd(next.removed.keys(), ver.added, ver.removed);
   }

   next.extTotal -= ver.extTotal;
}
setRemoveAdd ::= function (source, toRemove, toAdd) {
   for (let x of source) {
      if (toRemove.has(x)) {
         toRemove.delete(x);
      }
      else {
         toAdd.add(x);
      }
   }
}
mapRemoveAdd ::= function (source, toRemove, toAdd) {
   for (let [key, val] of source) {
      if (toRemove.has(key)) {
         toRemove.delete(key);
      }
      else {
         toAdd.set(key, val);
      }
   }
}
versionAdd ::= function (ver, rec) {
   if (ver.owner.isKeyed) {
      let [rkey, rval] = rec;

      if ($.isVersionExtended(ver)) {
         ver.added.set(rkey, rval);
      }
      else {
         ver.added.add(rkey);
      }
   }
   else if (ver.removed.has(rec)) {
      ver.removed.delete(rec);
   }
   else {
      ver.added.add(rec);
   }
}
versionRemove ::= function (ver, rec) {
   if (ver.owner.isKeyed) {
      let [rkey, rval] = rec;

      if (ver.added.has(rkey)) {
         ver.added.delete(rkey);
      }
      else {
         if ($.isVersionExtended(ver)) {
            ver.removed.set(rkey, rval);
         }
         else {
            ver.removed.add(rkey);
         }
      }
   }
   else if (ver.added.has(rec)) {
      ver.added.delete(rec);
   }
   else {
      ver.removed.add(rec);
   }
}
