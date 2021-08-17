common
   arraysEqual
   assert
   filter
   find
   hasOwnProperty
   hasNoEnumerableProps
   concat
   map
   selectProps
   trackingFinal
prolog-version
   refCurrentState
   isVersionUpToDate
   mergeDelta
   deltaAdd
   unchainVersions
   releaseVersion
prolog-index
   initIndex
   copyIndex
   buildIndex
   indexAdd
   indexRemove
prolog-infer
   inferredRelation
-----
factualRelation ::= function ({name, attrs, indices, facts}) {
   $.assert(facts instanceof Set);

   let uniqueIndices = [];
   let allIndices = [];

   for (let index of indices) {
      let idx = $.initIndex(index);

      // Build only unique indices. Non-unique indices will only be built by concrete
      // projections when needed.  Unique indices are also build separately for
      // projections (except the full one which reuses the relation's unique indices).
      if (idx.isUnique) {
         $.buildIndex(idx, facts);
         idx.refcount = 1;  // the index is always kept alive
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
         indices: []
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
         indices: []
      };
   }

   $.markProjectionValid(proj);

   return proj;
}
releaseProjection ::= function (proj) {
   $.assert(proj.refcount > 0);

   proj.refcount -= 1;

   if (proj.refcount === 0) {
      $.assert(proj.indices.length === 0);
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
markProjectionValid ::= function (proj) {
   proj.isValid = true;
   proj.rel.validProjs.add(proj);
}
isFullProjection ::= function (proj) {
   return proj.boundAttrs === null;
}
factSatisfies ::= function (fact, boundAttrs) {
   for (let [attr, val] of Object.entries(boundAttrs)) {
      if (fact[attr] !== val) {
         return false;
      }
   }

   return true;
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
      if (delta !== null) {
         $.mergeDelta(delta, proj.base.delta);
      }
   }
   else {
      for (let [fact, action] of proj.base.delta) {
         if (action === 'add') {
            if ($.factSatisfies(fact, proj.boundAttrs)) {
               proj.value.add(fact);

               for (let index of proj.indices) {
                  $.indexAdd(index, fact);
               }

               if (delta !== null) {
                  $.deltaAdd(delta, fact, 'add');
               }
            }
         }
         else if (proj.value.has(fact)) {
            proj.value.delete(fact);

            for (let index of proj.indices) {
               $.indexRemove(index, fact);
            }

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
addFact ::= function (rel, fact) {
   if (rel.facts.has(fact)) {
      throw new Error(`Duplicate fact`);
   }

   rel.facts.add(fact);

   for (let index of rel.uniqueIndices) {
      $.indexAdd(index, fact);
   }

   if (rel.latestVersion !== null) {
      $.deltaAdd(rel.latestVersion.delta, fact, 'add');
      $.invalidateProjs(rel);
   }
}
removeFact ::= function (rel, fact) {
   let wasRemoved = rel.facts.delete(fact);

   if (!wasRemoved) {
      throw new Error(`Missing fact`);
   }

   for (let index of rel.uniqueIndices) {
      $.indexRemove(index, fact);
   }

   if (rel.latestVersion !== null) {
      $.deltaAdd(rel.latestVersion.delta, fact, 'remove');
      $.invalidateProjs(rel);
   }
}
invalidateProjs ::= function (rel) {
   for (let proj of rel.validProjs) {
      proj.isValid = false;
   }

   rel.validProjs.clear();
}
refIndex ::= function (proj, indexedColumns) {
   for (let index of proj.indices) {
      if ($.arraysEqual(index, indexedColumns)) {
         index.refcount += 1;
         return index;
      }
   }

   if ($.isFullProjection(proj) && indexedColumns.isUnique) {
      // For full projections we simply reuse unique indices
      let index = proj.rel.uniqueIndices.find(idx => $.arraysEqual(idx, indexedColumns));      
      index.refcount += 1;
      return index;
   }

   let index = $.copyIndex(indexedColumns);

   index.refcount = 1;
   index.parent = proj;
   proj.indices.push(index);

   $.buildIndex(index, proj.value);

   return index;
}
releaseIndex ::= function (index) {
   $.assert(index.refcount > 0);

   index.refcount -= 1;

   if (index.refcount === 0) {
      let i = index.parent.indices.indexOf(index);
      $.assert(i !== -1);
      index.parent.indices.splice(i, 1);
   }
}
