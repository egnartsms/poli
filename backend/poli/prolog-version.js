common
   assert
   check
   setsDeleteIntersection
   greaterLesserSet
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
      added: new Set,
      removed: new Set,
   };
}
isVersionUpToDate ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
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

   $.unchainVersions(ver.next);

   let next = ver.next;
   let isNextMutable = next.refcount === 1;
   let isKeyed = ver.owner.keyed !== false;

   if (isNextMutable) {
      $.setsDeleteIntersection(ver.added, next.removed);
      if (!isKeyed) {
         $.setsDeleteIntersection(ver.removed, next.added);
      }

      let [ga, la] = $.greaterLesserSet(ver.added, next.added);
      let [gr, lr] = $.greaterLesserSet(ver.removed, next.removed);

      $.setAddAll(ga, la);
      $.setAddAll(gr, lr);

      ver.added = ga;
      ver.removed = gr;

      next.added = null;
      next.removed = null;
   }
   else {
      if (isKeyed) {
         for (let rec of next.added) {
            ver.added.add(rec);
         }
      }
      else {
         for (let rec of next.added) {
            if (ver.removed.has(rec)) {
               ver.removed.delete(rec);
            }
            else {
               ver.added.add(rec);
            }
         }
      }

      for (let rec of next.removed) {
         if (ver.added.has(rec)) {
            ver.added.delete(rec);
         }
         else {
            ver.removed.add(rec);
         }
      }
   }

   ver.next = null;
   $.releaseVersion(next);
}
verRemove1 ::= function (ver, rkey) {
   if (ver.added.has(rkey)) {
      ver.added.delete(rkey);
   }
   else {
      ver.removed.add(rkey);
   }
}
verAdd1 ::= function (ver, rkey) {
   if (ver.owner.keyed !== false) {
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
deltaAppend ::= function (delta, keyed, recKey, action) {
   (keyed !== false ? $.kDeltaAppend : $.nkDeltaAccum)(delta, recKey, action);
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
