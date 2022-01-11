common
   assert
   check
   isA
   isIterableEmpty
dedb-base
   clsBaseRelation
   clsRecKeyBoundProjection
   clsUniqueHitProjection
   clsHitProjection
   clsNoHitProjection
   clsFullProjection
dedb-derived
   clsDerivedProjection
dedb-relation
   rec2key
set-map
   deleteIntersection
   greaterLesser
   addAll
   setAll
-----
refCurrentState ::= function (owner) {
   if (owner.class === $.clsBaseRelation || owner.class === $.clsDerivedProjection) {
      return $.refMultiVersion(owner);
   }

   if (owner.class === $.clsHitProjection || owner.class === $.clsNoHitProjection) {
      if (owner.depVer === null) {
         owner.depVer = $.refCurrentState(owner.rel);
      }

      return $.refMultiVersion(owner);
   }

   if (owner.class === $.clsRecKeyBoundProjection) {
      return $.makeRecKeyBoundVersion(owner);
   }

   if (owner.class === $.clsUniqueHitProjection) {
      return $.makeUniqueHitVersion(owner);
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
clsUniqueHitVersion ::= ({
   name: 'version.uniqueHit',
   'version.uniqueHit': true,
   'version': true
})
makeUniqueHitVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsUniqueHitProjection);

   return {
      class: $.clsUniqueHitVersion,
      proj: proj,
      rec: proj.rec
   }
}
clsRecKeyBoundVersion ::= ({
   name: 'version.recKeyBound',
   'version.recKeyBound': true,
   'version': true
})
makeRecKeyBoundVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsRecKeyBoundProjection);

   return {
      class: $.clsRecKeyBoundVersion,
      proj: proj,
      rval: proj.rval
   }
}
refFullProjectionVersion ::= function (proj) {
   $.assert(() => proj.class === $.clsFullProjection);

   return $.refCurrentState(proj.rel);
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
ensureTopmostFresh ::= function (owner) {
   let prev = owner.myVer;
   
   if (prev !== null && $.isMultiVersionFresh(prev)) {
      return;
   }

   let ver = {
      class: $.clsMultiVersion,
      owner,
      num: 1 + (prev === null ? 0 : prev.num),
      refCount: prev === null ? 0 : 1,
      added: new Set,
      removed: new ($.requiresExtendedVersion(owner) ? Map : Set),
      next: null,
   };

   if (prev !== null) {
      prev.next = ver;
   }

   owner.myVer = ver;
}
isMultiVersionFresh ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
}
requiresExtendedVersion ::= function (owner) {
   return owner.class === $.clsBaseRelation && owner.isKeyed;
}
isMultiVersionExtended ::= function (ver) {
   return $.requiresExtendedVersion(ver.owner);
}
releaseVersion ::= function (ver) {
   if (ver.class !== $.clsMultiVersion) {
      return;
   }

   $.assert(() => ver.refCount > 0);

   ver.refCount -= 1;

   while (ver.refCount === 0 && ver.next !== null) {
      ver = ver.next;
      ver.refCount -= 1;
   }

   if (ver.refCount === 0) {
      $.assert(() => ver.owner.myVer === ver);
      
      $.nullifyMyVer(ver.owner);
   }
}
nullifyMyVer ::= function (owner) {
   owner.myVer = null;

   if (owner.class === $.clsHitProjection || owner.class === $.clsNoHitProjection) {
      $.assert(() => owner.depVer !== null);
      
      $.releaseVersion(owner.depVer);
      owner.depVer = null;
   }
}
unchainVersion ::= function (ver) {
   if (ver.class !== $.clsMultiVersion) {
      return;
   }

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
   let isExtended = $.isMultiVersionExtended(ver);
   let isNextDone = next.refCount === 1;

   if (isNextDone) {
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
      $.addAll(ver.added, next.added);
      (isExtended ? $.mapSplitMerge : $.setSplitMerge)(next.removed, ver.added, ver.removed);
   }
}
setSplitMerge ::= function (source, toRemove, toAdd) {
   for (let x of source) {
      $.removeOrAdd(x, toRemove, toAdd);
   }
}
removeOrAdd ::= function (item, toRemove, toAdd) {
   if (toRemove.has(item)) {
      toRemove.delete(item);
   }
   else {
      toAdd.add(item);
   }
}
mapSplitMerge ::= function (source, toRemove, toAdd) {
   for (let [key, val] of source) {
      $.removeOrSet(key, val, toRemove, toAdd);
   }
}
removeOrSet ::= function (key, val, toRemove, toAdd) {
   if (toRemove.has(key)) {
      toRemove.delete(key);
   }
   else {
      toAdd.set(key, val);
   }
}
multiVersionAddKey ::= function (ver, rkey) {
   if (ver.owner.isKeyed) {
      ver.added.add(rkey);
   }
   else {
      $.removeOrAdd(rkey, ver.removed, ver.added);
   }
}
multiVersionRemoveKey ::= function (ver, rkey) {
   $.assert(() => !$.isMultiVersionExtended(ver));

   $.removeOrAdd(rkey, ver.added, ver.removed);
}
multiVersionRemovePair ::= function (ver, rkey, rval) {
   if ($.isMultiVersionExtended(ver)) {
      $.removeOrSet(rkey, rval, ver.added, ver.removed);
   }
   else {
      $.assert(() => rkey === rval);
      $.removeOrAdd(rkey, ver.added, ver.removed);
   }
}
isVersionFresh ::= function (ver) {
   if (ver.class === $.clsRecKeyBoundVersion) {
      let {proj} = ver;

      return ver.rval === proj.rval;
   }

   if (ver.class === $.clsUniqueHitVersion) {
      let {proj} = ver;

      // proj.rec is fetched from unique index, so we can count on referential equality
      return ver.rec === proj.rec;
   }

   if (ver.class === $.clsMultiVersion) {
      return $.isMultiVersionFresh(ver);
   }

   throw new Error;
}
hasVersionAdded ::= function (ver) {
   return !$.isIterableEmpty($.versionAddedKeys(ver));
}
versionAddedKeys ::= function (ver) {
   if (ver.class === $.clsRecKeyBoundVersion) {
      let {proj} = ver;

      if (ver.rval !== proj.rval && proj.rval !== undefined) {
         return [proj.rkey];
      }
      else {
         return [];
      }
   }

   if (ver.class === $.clsUniqueHitVersion) {
      let {proj} = ver;

      if (ver.rec !== proj.rec && proj.rec !== undefined) {
         return [$.rec2key(proj, proj.rec)];
      }
      else {
         return [];
      }
   }

   if (ver.class === $.clsMultiVersion) {
      return ver.added;
   }

   throw new Error;
}
hasVersionRemoved ::= function (ver) {
   return !$.isIterableEmpty($.versionRemovedKeys(ver));
}
versionRemovedKeys ::= function (ver) {
   if (ver.class === $.clsRecKeyBoundVersion) {
      let {proj} = ver;

      if (ver.rval !== proj.rval && ver.rval !== undefined) {
         return [proj.rkey];
      }
      else {
         return [];
      }
   }

   if (ver.class === $.clsUniqueHitVersion) {
      let {proj} = ver;

      if (ver.rec !== proj.rec && ver.rec !== undefined) {
         return [proj.isKeyed ? ver.rec[0] : ver.rec];
      }
      else {
         return [];
      }
   }

   if (ver.class === $.clsMultiVersion) {
      return ver.removed.keys();
   }

   throw new Error;
}
