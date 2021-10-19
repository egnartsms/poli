common
   assert
   check
set-operation
   setsDeleteIntersection
   greaterLesserSet
   setAddAll
dedb-common
   RecordType
-----
refCurrentState ::= function (parent) {
   // 'parent' is a base relation or projection (of either base or derived relation)
   // Full base projections are "transparent" i.e. they have no storage of their own
   // (they share storage with their relation).
   let owner = parent.records.owner;

   if (owner.myVer === null || !$.isVersionUpToDate(owner.myVer)) {
      owner.myVer = $.makeVersion(owner);
   }
   
   owner.myVer.refcount += 1;

   return owner.myVer;
}
isVersionUpToDate ::= function (ver) {
   return ver.added.size === 0 && ver.removed.size === 0;
}
makeVersion ::= function (owner) {
   let prev = owner.myVer;
   let ver = {
      owner,
      num: (prev !== null ? prev.num : 0) + 1,
      next: null,
      refcount: prev !== null ? 1 : 0,
      added: new Set,
      removed: new Set,
   };

   if (prev !== null) {
      prev.next = ver;
   }

   return ver;
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
      else if (ver.next !== null) {
         $.releaseVersion(ver.next);
      }
   }
}
unchainVersion ::= function (ver) {
   if (ver.next === null) {
      return;
   }

   $.ensureTopmostUpToDate(ver.owner);
   
   let topmost = ver.owner.myVer;

   (function rec(ver) {
      if (ver.next === topmost) {
         return;
      }

      let next = ver.next;

      rec(next);
      
      let isNextMutable = next.refcount === 1;

      if (isNextMutable) {
         $.setsDeleteIntersection(ver.added, next.removed);
         if (!ver.owner.isKeyed) {
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
         if (ver.owner.isKeyed) {
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

      ver.next = topmost;
      topmost.refcount += 1;
      $.releaseVersion(next);
   })(ver);
}
ensureTopmostUpToDate ::= function (owner) {
   if (owner.myVer !== null && !$.isVersionUpToDate(owner.myVer)) {
      owner.myVer = makeVersion(owner);
   }
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
