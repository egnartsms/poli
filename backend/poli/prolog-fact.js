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

   for (let index of indices) {
      index.unique = !!index.unique;

      // Build only unique indices. Normal indices will be built when the full projection
      // of this relation is needed (if ever).
      if (index.unique) {
         $.buildIndex(index, facts);
         uniqueIndices.push(index);
      }
   }

   return {
      isFactual: true,
      name: name,
      attrs: attrs,
      indices: indices,
      uniqueIndices: uniqueIndices,
      indmap: [],
      projmap: new Map,
      projs: new Set,
      validProjs: new Set,
      curver: null,
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
         curver: base,  // just to resemble partial projections
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
         curver: {
            num: 1,
            next: null,
            refcount: 1,  // projection refs its curver
            // this will be populated when the next version is created
            delta: new Map
         },
         value: new Set($.filter(rel.facts, f => $.factSatisfies(f, boundAttrs))),
      };
   }

   rel.projs.add(proj);
   $.markProjectionValid(proj);

   return proj;
}
forgetProjection ::= function (proj) {
   let rel = proj.rel;

   $.assert(rel.isFactual);
   
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
}
releaseProjection ::= function (proj) {
   $.assert(proj.refcount > 0);

   proj.refcount -= 1;

   if (proj.refcount === 0) {
      $.forgetProjection(proj);
   }
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
refCurrentState ::= function (rel) {
   $.assert(rel.isFactual);

   if (rel.curver === null) {
      rel.curver = {
         num: 1,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      }
   }
   else if ($.isVersionEmpty(rel.curver)) {
      rel.curver.refcount += 1;
   }
   else {
      let newver = {
         num: 0,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      };
      $.linkNewHeadVersion(rel.curver, newver);
      rel.curver = newver;
   }

   return rel.curver;
}
isVersionEmpty ::= function (ver) {
   return ver.delta.size === 0;
}
isVersionNewest ::= function (ver) {
   return ver.next === null;
}
linkNewHeadVersion ::= function (ver0, ver1) {
   ver1.num = ver0.num + 1;
   ver0.next = ver1;
   ver1.refcount += 1;
}
releaseVersion ::= function (ver) {
   // Drop version's refcount by 1.  Works for both factual relation versions and
   // projection versions
   $.assert(ver.refcount > 0);

   ver.refcount -= 1;

   if (ver.refcount === 0 && ver.next !== null) {
      $.releaseVersion(ver.next);
   }
}
updateProjection ::= function (proj) {
   $.assert(proj.rel.isFactual);

   if (proj.isValid) {
      return;
   }

   if ($.isVersionNewest(proj.base) && $.isVersionEmpty(proj.base)) {
      $.markProjectionValid(proj);
      return;
   }

   let newBase = $.refCurrentState(proj.rel);

   // if they're the same we would have fallen into the if branch above
   $.assert(proj.base !== newBase);

   if ($.isFullProjection(proj)) {
      $.releaseVersion(proj.base);

      proj.base = newBase;  // already reffed it
      proj.curver = proj.base;  // always refers to the same version as 'proj.base'

      $.markProjectionValid(proj);

      return;
   }

   $.reduceVersions(proj.base);

   // Optimization: if nobody else needs our current version, there's no point in
   // computing delta for it.  Just update the 'value'
   let delta = proj.curver.refcount > 1 ? proj.curver.delta : null;

   for (let [fact, action] of proj.base.delta) {
      if (action === 'add') {
         if ($.factSatisfies(fact, proj.boundAttrs)) {
            proj.value.add(fact);
            if (delta !== null) {
               delta.set(fact, 'add');
            }
         }
      }
      else if (proj.value.has(fact)) {
         proj.value.delete(fact);
         if (delta !== null) {
            delta.set(fact, 'remove');
         }
      }
   }

   $.releaseVersion(proj.base);
   proj.base = newBase;  // already reffed it

   if (delta !== null && delta.size > 0) {
      let newver = {
         num: 0,
         next: null,
         refcount: 1,  // projection always references its curver
         delta: new Map,
      };
      $.linkNewHeadVersion(proj.curver, newver);
      $.releaseVersion(proj.curver);
      proj.curver = newver;
   }

   $.markProjectionValid(proj);
}
reduceVersions ::= function (ver) {
   if (ver.next === null || ver.next.next === null) {
      return;
   }

   let next = ver.next;

   $.reduceVersions(next);

   if (next.refcount === 1 && ver.delta.size < next.delta.size) {
      // The "next" version is only referenced by "ver" which means that after
      // this reduction operation it will be thrown away, which means we can reuse
      // its "delta" map if it's bigger than "ver.delta".
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
addFact ::= function (rel, fact) {
   if (rel.facts.has(fact)) {
      throw new Error(`Duplicate fact`);
   }

   rel.facts.add(fact);

   if (rel.curver !== null) {
      $.deltaAdd(rel.curver.delta, fact, 'add');
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

   if (rel.curver !== null) {
      $.deltaAdd(rel.curver.delta, fact, 'remove');
      for (let index of rel.uniqueIndices) {
         $.indexRemove(index, fact);
      }
      $.invalidateProjs(rel);
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
invalidateProjs ::= function (rel) {
   for (let proj of rel.validProjs) {
      proj.isValid = false;
   }

   rel.validProjs.clear();
}
