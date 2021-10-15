common
   all
   arraysEqual
   assert
   check
   filter
   find
   hasNoEnumerableProps
   hasOwnProperty
   concat
   map
   ownEntries
   selectProps
   trackingFinal
dedb-rec-key
   recKey
   recVal
   normalizeAttrsForPk
   recKeyOf
   Keyed
   makeAccessors
dedb-version
   refCurrentState
   isVersionUpToDate
   verAdd1
   verRemove1
   unchainVersions
   releaseVersion
dedb-index
   copyIndex
   rebuildIndex
   indexAdd
   indexRemove
dedb-index-instance
   indexInstanceStorage
dedb-projection
   invalidateProjections
   makeRecords
dedb-goal
   relGoal
-----
baseRelation ::= function ({
   name,
   attrs,
   indices,
   records=[]
}) {
   let {keyed} = $.normalizeAttrsForPk(attrs);

   let indexInstances = $.indexInstanceStorage();
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
      keyed: keyed,
      indices: availableIndices,
      projmap: new Map,
      myVer: null,
      records: null,  // intialized below
      myIndexInstances: indexInstances,  // shared with the full projection
      validRevDeps: new Set,  // 'revdeps' here means projections

      at: function (attrs) {
         return $.relGoal(this, attrs);
      },
   };

   rel.records = $.makeRecords(rel, records);

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
         keyed: rel.keyed,
         boundAttrs: boundAttrs,
         depVer: null,  // always null
         myVer: null,  // always null
         records: rel.records,  // shared
         myIndexInstances: rel.myIndexInstances,  // shared
         validRevDeps: new Set,

         ...$.makeAccessors(rel.keyed)
      };
   }
   else {
      proj = {
         rel: rel,
         refcount: 0,
         isValid: true,
         keyed: rel.keyed,
         boundAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         records: null,  // initialized below
         myIndexInstances: $.indexInstanceStorage(),
         validRevDeps: new Set,

         ...$.makeAccessors(rel.keyed)
      };

      proj.records = $.makeRecords(
         proj,
         $.filter(rel.records, rec => $.recSatisfies(proj, rec)),
      );
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
   return $.all($.ownEntries(proj.boundAttrs), ([attr, val]) => {
      return proj.recAttr(rec, attr) === val;
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

   for (let rkey of proj.depVer.removed) {
      $.deleteRecByKey(proj, rkey);
   }
   
   for (let rkey of proj.depVer.added) {
      let rec = proj.rel.records.getEntry(rkey);

      if ($.recSatisfies(proj, rec)) {
         $.addRec(proj, rec);
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
      $.verAdd1(parent.myVer, parent.keyed === false ? rec : rec[0]);
   }

   for (let idxInst of parent.myIndexInstances) {
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
      $.verRemove1(parent.myVer, recKey);
   }

   for (let idxInst of parent.myIndexInstances) {
      $.indexRemove(idxInst, rec);
   }

   return true;
}
addFact ::= function (rel, recKey, recVal=undefined) {
   $.check(Boolean(rel.keyed) === (recVal !== undefined));
   $.check(!rel.records.has(recKey), `Duplicate record`);

   let rec = rel.keyed ? [recKey, recVal] : recKey;

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
      rel.keyed,
      `Cannot change fact in a relation that does not have primary key`
   );
   
   let removed = $.deleteRecByKey(rel, recKey);

   $.check(removed, `Missing record`);

   $.addRec(rel, [recKey, newValue]);

   $.invalidate(rel);
}
invalidate ::= function (rel) {
   $.invalidateProjections(...rel.validRevDeps);
   rel.validRevDeps.clear();
}
