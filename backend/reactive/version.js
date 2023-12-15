class Version {
   added = new Set;
   removed = new Set;
   next = null;

   add(item) {
      if (this.removed.has(item)) {
         this.removed.delete(item);
      }
      else {
         this.added.add(item);
      }
   }

   remove(item) {
      if (this.added.has(item)) {
         this.added.delete(item);
      }
      else {
         this.removed.add(item);
      }
   }

   isClean() {
      return this.added.size === 0 && this.removed.size === 0;
   }

   unchain(myColl) {
      if (this.next === null) {
         return;
      }

      let mostRecent = myColl.currentVersion();
      let ver = this;
      let versions = [];

      while (ver.next !== mostRecent) {
         versions.push(ver);
         ver = ver.next;
      }

      while (versions.length > 0) {
         ver = versions.pop();

         mergeVersions(ver, ver.next);
         ver.next = mostRecent;
      }
   }
}


function mergeVersions(ver, next) {
   for (let item of next.removed) {
      if (ver.added.has(item)) {
         ver.added.delete(item);
      }
      else {
         ver.removed.add(item);
      }
   }

   for (let item of next.added) {
      if (ver.removed.has(item)) {
         ver.removed.delete(item);
      }
      else {
         ver.added.add(item);
      }
   }
}
