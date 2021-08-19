common
   assert
-----
refCurrentState ::= function (parent) {
   // 'parent' is a base relation or a projection of either base or derived relation
   if (parent.myVer === null) {
      parent.myVer = {
         parent: parent,
         num: 1,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      }
   }
   else if ($.isVersionUpToDate(parent.myVer)) {
      parent.myVer.refcount += 1;
   }
   else {
      let newver = {
         parent: parent,
         num: 0,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      };
      $.linkVersions(parent.myVer, newver);
      parent.myVer = newver;
   }

   return parent.myVer;
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
   $.assert(ver.refcount > 0);

   ver.refcount -= 1;

   if (ver.refcount === 0) {
      if (ver.parent.myVer === ver) {
         ver.parent.myVer = null;
      }

      if (ver.next !== null) {
         $.releaseVersion(ver.next);
      }
   }
}
unchainVersions ::= function (ver) {
   if (ver.next === null || ver.next.next === null) {
      return;
   }

   let next = ver.next;

   $.unchainVersions(next);

   if (next.refcount === 1 && ver.delta.size < next.delta.size) {
      // The 'next' version is only referenced by 'ver' which means that after
      // this reduction operation it will be thrown away, which means we can reuse
      // its 'delta' map if it's bigger than 'ver.delta'.
      $.mergeDelta(next.delta, ver.delta);
      ver.delta = next.delta;
      next.delta = null;
   }
   else {
      $.mergeDelta(ver.delta, next.delta);
   }

   ver.next = next.next;
   ver.next.refcount += 1;
   $.releaseVersion(next);
}
mergeDelta ::= function (dstD, srcD) {
   for (let [tuple, action] of srcD) {
      $.deltaAdd(dstD, tuple, action);
   }
}
deltaAdd ::= function (delta, tuple, action) {
   let existingAction = delta.get(tuple);

   if (existingAction !== undefined) {
      $.assert(existingAction !== action);
      delta.delete(tuple);
   }
   else {
      delta.set(tuple, action);
   }
}