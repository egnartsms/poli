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
   indexOn
   copyIndex
   buildIndex
   indexAdd
   indexRemove
prolog-projection
   isFullProjection
   invalidateProjections
-----
baseRelation ::= function ({name, attrs, indices, facts}) {
   $.assert(facts instanceof Set);

   let uniqueIndices = [];
   let allIndices = [];

   for (let index of indices) {
      let idx = $.indexOn(index);

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
      isBase: true,
      name: name,
      attrs: attrs,
      indices: allIndices,
      uniqueIndices: uniqueIndices,
      projmap: new Map,
      myVer: null,
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
      depVer: $.refCurrentState(rel),
      myVer: null,
      value: $.hasNoEnumerableProps(boundAttrs) ?
         rel.facts :
         new Set($.filter(rel.facts, f => $.factSatisfies(f, boundAttrs))),
      indexInstances: [],
      validRevDeps: new Set,
   };

   $.markProjectionValid(proj);

   return proj;
}
freeProjection ::= function (proj) {
   proj.rel.validRevDeps.delete(proj);
   $.releaseVersion(proj.depVer);
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

   if ($.isVersionUpToDate(proj.depVer)) {
      $.markProjectionValid(proj);
      return;
   }

   $.unchainVersions(proj.depVer);

   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   if ($.isFullProjection(proj)) {
      if (delta !== null) {
         $.mergeDelta(delta, proj.depVer.delta);
      }
   }
   else {
      for (let [fact, action] of proj.depVer.delta) {
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

   // Update index instances for this projection
   for (let idxInst of proj.indexInstances) {
      for (let [fact, action] of proj.depVer.delta) {
         (action === 'add' ? $.indexAdd : $.indexRemove)(idxInst, fact);
      }
   }

   let newDepVer = $.refCurrentState(proj.rel);
   $.releaseVersion(proj.depVer);
   proj.depVer = newDepVer;

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

   if (rel.myVer !== null) {
      $.deltaAdd(rel.myVer.delta, fact, 'add');
      $.invalidate(rel);
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

   if (rel.myVer !== null) {
      $.deltaAdd(rel.myVer.delta, fact, 'remove');
      $.invalidate(rel);
   }
}
invalidate ::= function (rel) {
   $.invalidateProjections(...rel.validRevDeps);
   rel.validRevDeps.clear();
}
