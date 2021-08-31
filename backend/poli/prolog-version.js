common
   assert
   check
-----
refCurrentState ::= function (parent) {
   // 'parent' is a base relation or projection (of either base or derived relation)
   // Full base projections are "transparent" i.e. they have no storage of their own
   // (they share storage with their relation).
   let owner = parent.records.owner;

   if (owner.myVer === null) {
      owner.myVer = $.makeVersionOf(owner);
   }
   else if (!$.isVersionUpToDate(owner.myVer)) {
      let newver = $.makeVersionOf(owner);
      $.linkVersions(owner.myVer, newver);
      owner.myVer = newver;
   }

   owner.myVer.refcount += 1;

   return owner.myVer;
}
makeVersionOf ::= function (owner) {
   return {
      owner: owner,
      num: 1,
      next: null,
      refcount: 0,
      delta: new Map
   }
}
isVersionUpToDate ::= function (ver) {
   return ver.delta.size === 0;
}
linkVersions ::= function (ver0, ver1) {
   ver1.num = ver0.num + 1;
   ver0.next = ver1;
   ver1.refcount += 1;
}
releaseVersion ::= function (ver) {
   // Drop version's refcount by 1.  Works for both base relation versions and
   // projection versions
   $.check(ver.refcount > 0);

   ver.refcount -= 1;

   if (ver.refcount === 0) {
      if (ver.owner.myVer === ver) {
         ver.owner.myVer = null;
      }

      if (ver.next !== null) {
         $.releaseVersion(ver.next);
      }
   }
}
unchainVersions ::= function (ver) {
   if (ver.next === null) {
      return;
   }

   let next = ver.next;

   $.unchainVersions(next);

   if (next.refcount === 1 && ver.delta.size < next.delta.size) {
      // The 'next' version is only referenced by 'ver' which means that after
      // this reduction operation it will be thrown away, which means we can reuse
      // its 'delta' map if it's bigger than 'ver.delta'.
      $.mergeIntoNext(ver.delta, next.delta, ver.owner.isKeyed);
      ver.delta = next.delta;
   }
   else {
      $.mergeIntoPrev(ver.delta, next.delta, ver.owner.isKeyed);
   }

   ver.next = null;
   $.releaseVersion(next);
}
mergeIntoPrev ::= function (prev, next, isKeyed) {
   let fn = isKeyed ? $.kDeltaAppend : $.nkDeltaAccum;

   for (let [recKey, action] of next) {
      fn(prev, recKey, action);
   }
}
mergeIntoNext ::= function (prev, next, isKeyed) {
   let fn = isKeyed ? $.kDeltaPrepend : $.nkDeltaAccum;

   for (let [recKey, action] of prev) {
      fn(next, recKey, action);
   }
}
nkDeltaAccum ::= function (delta, rec, action) {
   // For non-keyed deltas, appending and prepending are the same
   //
   // NOTE: if proves critical, implement release-version of this logic that does this:
   // 1) delta.delete(rec); 2) if not deleted, delta.set(rec, action)
   let existingAction = delta.get(rec);

   if (existingAction !== undefined) {
      $.assert(() => existingAction !== action);
      delta.delete(rec);
   }
   else {
      delta.set(rec, action);
   }
}
kDeltaAppend ::= function (delta, recKey, action) {
   $.doAction(delta, recKey, $.composedAction(delta.get(recKey), action));
}
kDeltaPrepend ::= function (delta, recKey, action) {
   $.doAction(delta, recKey, $.composedAction(action, delta.get(recKey)));
}
deltaAppend ::= function (delta, isKeyed, recKey, action) {
   (isKeyed ? $.kDeltaAppend : $.nkDeltaAccum)(delta, recKey, action);
}
composedAction ::= function (oldAction, newAction) {
   let composedAction =
      oldAction === undefined ? newAction :
      newAction === undefined ? oldAction :
      $.keyedActionComposition[oldAction][newAction];

   $.assert(() => composedAction !== undefined);

   return composedAction;
}
keyedActionComposition ::= ({
   // T[prevAction][nextAction] = resultAction
   add: {
      remove: 'clear',
      change: 'add'
   },
   remove: {
      add: 'change',
   },
   change: {
      remove: 'remove',
      change: 'change'
   }
})
doAction ::= function (delta, key, action) {
   if (action === 'clear') {
      delta.delete(key);
   }
   else {
      delta.set(key, action);
   }
}
