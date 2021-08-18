common
   arraysEqual
   assert
   filter
   find
   hasNoEnumerableProps
   hasOwnProperty
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
prolog-projection
   isFullProjection
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
      latestVersion: null,
      facts: facts,
      validRevDeps: new Set,  // 'revdeps' here means projections
   }
}
makeProjection ::= function (rel, boundAttrs) {
   let proj = {
      rel: rel,
      refcount: 0,
      isValid: true,
      boundAttrs: boundAttrs,
      base: $.refCurrentState(rel),
      latestVersion: null,
      value: $.hasNoEnumerableProps(boundAttrs) ?
         rel.facts :
         new Set($.filter(rel.facts, f => $.factSatisfies(f, boundAttrs))),
      indices: [],
      validRevDeps: new Set,
   };

   $.markProjectionValid(proj);

   return proj;
}
freeProjection ::= function (proj) {
   proj.rel.validRevDeps.delete(proj);
}
markProjectionValid ::= function (proj) {
   proj.isValid = true;
   proj.rel.validRevDeps.add(proj);
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
   for (let proj of rel.validRevDeps) {
      proj.isValid = false;
   }

   rel.validRevDeps.clear();
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
