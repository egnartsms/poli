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
-----
refRelationState ::= function (rel) {
   $.assert(() => rel.kind === 'base');

   $.ensureTopmostFresh(rel);
   rel.myVer.refCount += 1;

   return rel.myVer;
}
refProjectionState ::= function (proj) {
   if (proj.kind === 'derived') {
      $.ensureTopmostFresh(proj);
      proj.myVer.refCount += 1;

      return proj.myVer;
   }

   if (proj.kind === 'partial') {
      if (proj.depVer === null) {
         proj.depVer = $.refRelationState(proj.rel);
      }

      $.ensureTopmostFresh(proj);
      proj.myVer.refCount += 1;

      return proj.myVer;
   }

   if (proj.kind === 'rec-key-bound') {
      return $.makeRecKeyBoundVersion(proj);
   }

   if (proj.kind === 'unique-hit') {
      return $.makeUniqueHitVersion(proj);
   }

   if (proj.kind === 'full') {
      return $.refRelationState(proj.rel);
   }

   throw new Error;
}
makeRecKeyBoundVersion ::= function (proj) {
   $.assert(() => proj.kind === 'rec-key-bound');

   return {
      kind: 'rec-key-bound',
      proj: proj,
      rval: proj.rval
   }
}
makeUniqueHitVersion ::= function (proj) {
   $.assert(() => proj.kind === 'unique-hit');

   return {
      kind: 'unique-hit',
      proj: proj,
      rkey: proj.rkey,
      rval: proj.rval,
   }
}
makeZeroVersion ::= function (owner) {
   // Zero versions are not used yet. They will be needed when/if you implement the
   // combined full + partial derived projection computation algorithm
   return {
      kind: 'zero',
      owner
   }
}
ensureTopmostFresh ::= function (versionable) {
   let prev = versionable.myVer;
   
   if (prev !== null && $.isMultiVersionFresh(prev)) {
      return;
   }

   let ver = {
      kind: 'multi',
      owner: versionable,
      num: 1 + (prev === null ? 0 : prev.num),
      refCount: prev === null ? 0 : 1,
      added: new (versionable.isKeyed ? Map : Set)(),
      removed: new (versionable.isKeyed ? Map : Set)(),
      next: null,
   };

   if (prev !== null) {
      prev.next = ver;
   }

   versionable.myVer = ver;
}
isMultiVersionFresh ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
}
releaseVersion ::= function (ver) {
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
prepareVersion ::= function (ver) {
   if (ver.kind !== 'multi') {
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
   let isNextDone = next.refCount === 1;

   if (isNextDone) {
      $.deleteIntersection(ver.added, next.removed);

      let [ga, la] = $.greaterLesser(ver.added, next.added);
      let [gr, lr] = $.greaterLesser(ver.removed, next.removed);

      $.setAll(ga, la);
      $.setAll(gr, lr);

      ver.added = ga;
      ver.removed = gr;

      next.added = null;
      next.removed = null;
   }
   else {
      $.setAll(ver.added, next.added);
      $.mapSplitMerge(next.removed, ver.added, ver.removed);
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
isVersionPristine ::= function (ver) {
   if (ver.kind === 'rec-key-bound') {
      let {proj} = ver;

      return ver.rval === proj.rval;
   }

   if (ver.kind === 'unique-hit') {
      let {proj} = ver;

      return ver.rkey === proj.rkey && ver.rval === proj.rval;
   }

   if (ver.kind === 'multi') {
      return $.isMultiVersionFresh(ver);
   }

   throw new Error;
}
versionAddPair ::= function (ver, rkey, rval) {
   if (ver.owner.isKeyed) {
      ver.added.set(rkey, rval);
   }
   else {
      $.assert(() => rkey === rval);
      $.removeOrAdd(rkey, ver.removed, ver.added);
   }
}
versionRemovePair ::= function (ver, rkey, rval) {
   if (ver.owner.isKeyed) {
      $.removeOrSet(rkey, rval, ver.added, ver.removed);
   }
   else {
      $.assert(() => rkey === rval);
      $.removeOrAdd(rkey, ver.added, ver.removed);
   }
}
hasVersionAdded ::= function (ver) {
   if (ver.kind === 'rec-key-bound') {
      let {proj} = ver;

      return ver.rval !== proj.rval && proj.rval !== undefined
   }

   if (ver.kind === 'unique-hit') {
      let {proj} = ver;

      return (
         (ver.rkey !== proj.rkey || ver.rval !== proj.rval) && proj.rkey !== undefined
      )
   }

   if (ver.kind === 'multi') {
      return ver.added.size > 0;
   }

   throw new Error;
}
versionAddedPairs ::= function (ver) {
   if (ver.kind === 'rec-key-bound') {
      let {proj} = ver;

      if (ver.rval !== proj.rval && proj.rval !== undefined) {
         return [[proj.rkey, proj.rval]];
      }
      else {
         return [];
      }
   }

   if (ver.kind === 'unique-hit') {
      let {proj} = ver;

      if ((ver.rkey !== proj.rkey || ver.rval !== proj.rval) && proj.rkey !== undefined) {
         return [[proj.rkey, proj.rval]];
      }
      else {
         return [];
      }
   }

   if (ver.kind === 'multi') {
      return ver.added.entries();
   }

   throw new Error;
}
versionRemovedPairs ::= function (ver) {
   if (ver.kind === 'rec-key-bound') {
      let {proj} = ver;

      if (ver.rval !== proj.rval && ver.rval !== undefined) {
         return [[proj.rkey, ver.rval]];
      }
      else {
         return [];
      }
   }

   if (ver.kind === 'unique-hit') {
      let {proj} = ver;

      if ((ver.rkey !== proj.rkey || ver.rval !== proj.rval) && ver.rkey !== undefined) {
         return [[ver.rkey, ver.rval]];
      }
      else {
         return [];
      }
   }

   if (ver.kind === 'multi') {
      return ver.removed.entries();
   }

   throw new Error;
}
versionAddedKeyCont ::= function (ver) {
   // Similar to $.versionAddedPairs() but return a set/map of keys, not just iterable
   if (ver.kind === 'rec-key-bound') {
      let {proj} = ver;

      if (ver.rval !== proj.rval && proj.rval !== undefined) {
         return new Set([proj.rkey]);
      }
      else {
         return new Set;
      }
   }

   if (ver.kind === 'unique-hit') {
      let {proj} = ver;

      if ((ver.rkey !== proj.rkey || ver.rval !== proj.rval) && proj.rkey !== undefined) {
         return new Set([proj.rkey]);
      }
      else {
         return new Set;
      }
   }

   if (ver.kind === 'multi') {
      return ver.added;
   }

   throw new Error;
}
