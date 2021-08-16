common
   assert
   filter
   find
   hasOwnProperty
   hasNoEnumerableProps
   concat
   map
   selectProps
   trackingFinal
prolog-index
   initIndex
   buildIndex
   indexAdd
   indexRemove
prolog-infer
   inferredRelation
   visualizeIncrementalUpdateScheme
-----
factualRelation ::= function ({name, attrs, indices, facts}) {
   $.assert(facts instanceof Set);

   let uniqueIndices = [];
   let allIndices = [];

   for (let index of indices) {
      let idx = $.initIndex(index);

      // Build only unique indices. Non-unique indices will be built by concrete
      // projections when needed.
      if (idx.isUnique) {
         $.buildIndex(idx, facts);
         uniqueIndices.push(idx);
      }

      allIndices.push(idx);
   }

   return {
      isFactual: true,
      name: name,
      attrs: attrs,
      indices: allIndices,
      uniqueIndices: uniqueIndices,
      indmap: [],
      projmap: new Map,
      validProjs: new Set,
      latestVersion: null,
      facts: facts,
   }
}
projectionFor ::= function (rel, boundAttrs) {
   let map = rel.projmap;
   
   for (let [attr, isFinal] of $.trackingFinal(rel.attrs)) {
      let key = $.projmapKey(boundAttrs, attr);

      if (map.has(key)) {
         map = map.get(key);
      }
      else {
         let next = isFinal ? $.makeProjection(rel, boundAttrs) : new Map;
         map.set(key, next);
         map = next;
      }
   }

   return map;
}
attrFree ::= new Object
projmapKey ::= function (boundAttrs, attr) {
   return $.hasOwnProperty(boundAttrs, attr) ? boundAttrs[attr] : $.attrFree;
}
makeProjection ::= function (rel, boundAttrs) {
   $.assert(rel.isFactual);

   let base = $.refCurrentState(rel);
   let proj;

   if (Object.keys(boundAttrs).length === 0) {
      proj = {
         rel: rel,
         refcount: 0,
         isValid: true,
         boundAttrs: null,
         base: base,
         latestVersion: null,
         value: rel.facts,  
      };
   }
   else {
      proj = {
         rel: rel,
         refcount: 0,
         isValid: true,
         boundAttrs: boundAttrs,
         base: base,
         latestVersion: null,
         value: new Set($.filter(rel.facts, f => $.factSatisfies(f, boundAttrs))),
      };
   }

   $.markProjectionValid(proj);

   return proj;
}
releaseProjection ::= function (proj) {
   $.assert(proj.refcount > 0);

   proj.refcount -= 1;

   if (proj.refcount === 0) {
      $.forgetProjection(proj);
   }
}
forgetProjection ::= function (proj) {
   $.assert(proj.refcount === 0);

   let rel = proj.rel;

   (function go(i, map) {
      if (i === rel.attrs.length) {
         return;
      }

      let key = $.projmapKey(proj.boundAttrs, rel.attrs[i]);

      if (i === rel.attrs.length - 1) {
         map.delete(key);
      }
      else {
         let next = map.get(key);
         go(i + 1, next);
         if (next.size === 0) {
            map.delete(key);
         }
      }
   })(0, rel.projmap);

   rel.validProjs.delete(proj);
}
isFullProjection ::= function (proj) {
   return proj.boundAttrs === null;
}
markProjectionValid ::= function (proj) {
   proj.isValid = true;
   proj.rel.validProjs.add(proj);
}
factSatisfies ::= function (fact, boundAttrs) {
   for (let [attr, val] of Object.entries(boundAttrs)) {
      if (fact[attr] !== val) {
         return false;
      }
   }

   return true;
}
refCurrentState ::= function (parent) {
   // 'parent' is a factual relation or its projection
   if (parent.latestVersion === null) {
      parent.latestVersion = {
         parent: parent,
         num: 1,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      }
   }
   else if ($.isVersionUpToDate(parent.latestVersion)) {
      parent.latestVersion.refcount += 1;
   }
   else {
      let newver = {
         parent: parent,
         num: 0,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      };
      $.linkVersions(parent.latestVersion, newver);
      parent.latestVersion = newver;
   }

   return parent.latestVersion;
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
   // Drop version's refcount by 1.  Works for both factual relation versions and
   // projection versions
   $.assert(ver.refcount > 0);

   ver.refcount -= 1;

   if (ver.refcount === 0) {
      if (ver.parent.latestVersion === ver) {
         ver.parent.latestVersion = null;
      }

      if (ver.next !== null) {
         $.releaseVersion(ver.next);
      }
   }
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if ($.isVersionUpToDate(proj.base)) {
      $.markProjectionValid(proj);
      return;
   }

   let newBase = $.refCurrentState(proj.rel);  // reference already added for 'newBase'

   // if they were the same we would have fallen into the if branch above
   $.assert(proj.base !== newBase);

   $.unchainVersions(proj.base);

   let delta = proj.latestVersion !== null ? proj.latestVersion.delta : null;

   if ($.isFullProjection(proj)) {
      $.mergeDelta(proj.latestVersion.delta, proj.base.delta);
   }
   else {
      for (let [fact, action] of proj.base.delta) {
         if (action === 'add') {
            if ($.factSatisfies(fact, proj.boundAttrs)) {
               proj.value.add(fact);
               if (delta !== null) {
                  $.deltaAdd(delta, fact, 'add');
               }
            }
         }
         else if (proj.value.has(fact)) {
            proj.value.delete(fact);
            if (delta !== null) {
               $.deltaAdd(delta, fact, 'remove');
            }
         }
      }
   }
   
   $.releaseVersion(proj.base);
   proj.base = newBase;  // already reffed it

   $.markProjectionValid(proj);
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
addFact ::= function (rel, fact) {
   if (rel.facts.has(fact)) {
      throw new Error(`Duplicate fact`);
   }

   rel.facts.add(fact);

   if (rel.latestVersion !== null) {
      $.deltaAdd(rel.latestVersion.delta, fact, 'add');
      for (let index of rel.uniqueIndices) {
         $.indexAdd(index, fact);
      }
      $.invalidateProjs(rel);
   }
}
removeFact ::= function (rel, fact) {
   let wasRemoved = rel.facts.delete(fact);

   if (!wasRemoved) {
      throw new Error(`Missing fact`);
   }

   if (rel.latestVersion !== null) {
      $.deltaAdd(rel.latestVersion.delta, fact, 'remove');
      for (let index of rel.uniqueIndices) {
         $.indexRemove(index, fact);
      }
      $.invalidateProjs(rel);
   }
}
invalidateProjs ::= function (rel) {
   for (let proj of rel.validProjs) {
      proj.isValid = false;
   }

   rel.validProjs.clear();
}
