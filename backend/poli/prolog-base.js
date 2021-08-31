common
   all
   arraysEqual
   check
   filter
   find
   hasNoEnumerableProps
   hasOwnProperty
   concat
   map
   selectProps
   trackingFinal
prolog-shared
   recKey
   recVal
   recAttr
prolog-version
   refCurrentState
   isVersionUpToDate
   deltaAppend
   kDeltaAppend
   nkDeltaAccum
   unchainVersions
   releaseVersion
prolog-index
   copyIndex
   rebuildIndex
   indexAdd
   indexRemove
prolog-projection
   invalidateProjections
   makeRecords
-----
baseRelation ::= function ({
   name,
   attrs,
   hasNaturalIdentity=false,
   indices,
   records=[]
}) {
   if (hasNaturalIdentity) {
      if (attrs === $.recVal) {
         attrs = [$.recKey, $.recVal];
      }
      else {
         $.check(attrs.length > 0, `Expected either 'recVal' or non-empty array of attrs`);
         $.check(!attrs.includes($.recVal) && !attrs.includes($.recKey),
            `recVal/recKey must not be included in the attrs array`
         );
         attrs.unshift($.recKey);
      }
   }
   else {
      $.check(Array.isArray(attrs) && attrs.length > 0,
         `Expected non-empty array as attrs`
      );
   }

   records = $.makeRecords(records, hasNaturalIdentity);

   let indexInstances = [];
   let availableIndices = [];

   for (let index of indices) {
      if (index.isUnique) {
         let idxInst = $.copyIndex(index);

         idxInst.owner = null;  // will set to the relation object below
         idxInst.refcount = 1;  // always kept alive

         indexInstances.push(idxInst);
         availableIndices.push(idxInst);
      }
      else {
         availableIndices.push(index);
      }
   }

   let rel = {
      isBase: true,
      name: name,
      attrs: attrs,
      isKeyed: hasNaturalIdentity,
      indices: availableIndices,
      projmap: new Map,
      myVer: null,
      records: records,
      indexInstances: indexInstances,  // shared with the full projection
      validRevDeps: new Set,  // 'revdeps' here means projections
   };

   records.owner = rel;

   for (let idxInst of indexInstances) {
      idxInst.owner = rel;
      $.rebuildIndex(idxInst, records);
   }

   return rel;
}
makeProjection ::= function (rel, boundAttrs) {
   let proj;

   // We want to preserve the same shape for the full projection and partial ones
   // (for V8 optimizations).
   if ($.hasNoEnumerableProps(boundAttrs)) {
      proj = {
         rel: rel,
         refcount: 0,
         isValid: true,
         isKeyed: rel.isKeyed,
         boundAttrs: boundAttrs,
         depVer: null,  // always null
         myVer: null,  // always null
         records: rel.records,  // shared
         indexInstances: rel.indexInstances,  // shared
         validRevDeps: new Set,
      };
   }
   else {
      proj = {
         rel: rel,
         refcount: 0,
         isValid: true,
         isKeyed: rel.isKeyed,
         boundAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         records: null,
         indexInstances: [],
         validRevDeps: new Set,
      };

      proj.records = $.makeRecords(
         $.filter(rel.records, rec => $.recSatisfies(proj, rec)),
         rel.isKeyed
      );
      proj.records.owner = proj;
   }

   $.markProjectionValid(proj);

   return proj;
}
isFullProjection ::= function (proj) {
   return proj.depVer === null;
}
freeProjection ::= function (proj) {
   proj.rel.validRevDeps.delete(proj);
   if (!$.isFullProjection(proj)) {
      $.releaseVersion(proj.depVer);
   }
}
markProjectionValid ::= function (proj) {
   proj.isValid = true;
   proj.rel.validRevDeps.add(proj);
}
recSatisfies ::= function (proj, rec) {
   return $.all(Reflect.ownKeys(proj.boundAttrs), attr => {
      return $.recAttr(rec, attr, proj.isKeyed) === proj.boundAttrs[attr];
   });
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if ($.isFullProjection(proj) || $.isVersionUpToDate(proj.depVer)) {
      $.markProjectionValid(proj);
      return;
   }

   $.unchainVersions(proj.depVer);

   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   for (let [recKey, action] of proj.depVer.delta) {
      if (action === 'add') {
         let rec = proj.rel.records.getEntry(recKey);

         if ($.recSatisfies(proj, rec)) {
            $.addRec(proj, rec);
         }
      }
      else if (action === 'remove') {
         $.deleteRecByKey(proj, recKey);
      }
      else {
         $.assert(() => action === 'change');
         $.assert(() => proj.isKeyed);

         let isOldOurs = proj.records.has(recKey);
         let newValue = proj.rel.records.get(recKey);
         let isNewOurs = $.recSatisfies(proj, [recKey, newValue]);

         if (isOldOurs) {
            if (isNewOurs) {
               $.changeRec(proj, recKey, newValue);
            }
            else {
               $.deleteRecByKey(proj, recKey);
            }
         }
         else if (isNewOurs) {
            $.addRec(proj, [recKey, newValue]);
         }
      }
   }

   let newDepVer = $.refCurrentState(proj.rel);
   $.releaseVersion(proj.depVer);
   proj.depVer = newDepVer;

   $.markProjectionValid(proj);
}
addRec ::= function (parent, rec) {
   parent.records.add(rec);

   if (parent.myVer !== null) {
      if (parent.isKeyed) {
         $.kDeltaAppend(parent.myVer.delta, rec[0], 'add');
      }
      else {
         $.nkDeltaAccum(parent.myVer.delta, rec, 'add');
      }
   }

   for (let idxInst of parent.indexInstances) {
      $.indexAdd(idxInst, rec);
   }
}
deleteRecByKey ::= function (parent, recKey) {
   let rec = parent.records.getEntry(recKey);

   if (rec === undefined) {
      return false;
   }

   parent.records.delete(recKey);

   if (parent.myVer !== null) {
      $.deltaAppend(parent.myVer.delta, parent.isKeyed, recKey, 'remove');
   }

   for (let idxInst of parent.indexInstances) {
      $.indexRemove(idxInst, rec);
   }

   return true;
}
changeRec ::= function (parent, recKey, newValue) {
   let oldValue = parent.records.get(recKey);

   parent.records.set(recKey, newValue);

   if (parent.myVer !== null) {
      $.kDeltaAppend(parent.myVer.delta, recKey, 'change');
   }

   for (let idxInst of parent.indexInstances) {
      $.indexChange(idxInst, recKey, oldValue, newValue);
   }
}
addFact ::= function (rel, recKey, recVal=undefined) {
   $.check(rel.isKeyed === (recVal !== undefined));
   $.check(!rel.records.has(recKey), `Duplicate record`);

   let rec = rel.isKeyed ? [recKey, recVal] : recKey;

   $.addRec(rel, rec);
   
   $.invalidate(rel);
}
removeFact ::= function (rel, recKey) {
   let removed = $.deleteRecByKey(rel, recKey);
   
   $.check(removed, `Missing record`);
   
   $.invalidate(rel);
}
changeFact ::= function (rel, recKey, newValue) {
   $.check(
      rel.isKeyed,
      `Cannot change fact in a relation that does not have natural identity`
   );
   $.check(rel.records.has(recKey), `Missing record`);

   $.changeRec(rel, recKey, newValue);

   $.invalidate(rel);
}
invalidate ::= function (rel) {
   $.invalidateProjections(...rel.validRevDeps);
   rel.validRevDeps.clear();
}
