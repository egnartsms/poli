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
   newObj
   selectProps
   trackingFinal
dedb-rec-key
   recKey
   recVal
   normalizeAttrsForPk
dedb-version
   refCurrentState
   isVersionUpToDate
   verAdd1
   verRemove1
   unchainVersion
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
dedb-goal
   relGoal
dedb-common
   RelationType
   RecordType
   recTypeProto
   makeRecords
-----
baseRelation ::= function ({
   name,
   attrs,
   indices=[],
   records=[]
}) {
   let {recType} = $.normalizeAttrsForPk(attrs);

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

   let rel = $.newObj($.recTypeProto(recType), {
      type: $.RelationType.base,
      name: name,
      attrs: attrs,
      indices: availableIndices,
      projmap: new Map,
      myVer: null,
      myExtVer: null,
      records: null,  // intialized below
      myIndexInstances: indexInstances,  // shared with the full projection
      validRevDeps: new Set,  // 'revdeps' here means projections

      at(attrs) {
         return $.relGoal(this, attrs);
      },
   });

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
      proj = $.newObj($.recTypeProto(rel.recType), {
         rel: rel,
         refcount: 0,
         isValid: true,
         boundAttrs: boundAttrs,
         depVer: null,  // always null
         myVer: null,  // always null
         myExtVer: null,  // always null
         records: rel.records,  // shared
         myIndexInstances: rel.myIndexInstances,  // shared
         validRevDeps: new Set
      });
   }
   else {
      proj = $.newObj($.recTypeProto(rel.recType), {
         rel: rel,
         refcount: 0,
         isValid: true,
         boundAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         myExtVer: null,
         records: null,  // initialized below
         myIndexInstances: $.indexInstanceStorage(),
         validRevDeps: new Set
      });

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

   $.unchainVersion(proj.depVer);

   for (let rkey of proj.depVer.removed) {
      $.deleteRecByKey(proj, rkey);
   }
   
   for (let rkey of proj.depVer.added) {
      let rec = proj.rel.recAt(rkey);

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
   parent.addRecord(rec);

   if (parent.myVer !== null) {
      $.verAdd1(parent.myVer, parent.recKey(rec));
   }

   for (let idxInst of parent.myIndexInstances) {
      $.indexAdd(idxInst, rec);
   }
}
deleteRecByKey ::= function (parent, rkey) {
   let rec = parent.recAt(rkey);

   if (rec === undefined) {
      return false;
   }

   parent.records.delete(rkey);

   if (parent.myVer !== null) {
      $.verRemove1(parent.myVer, rkey);
   }

   for (let idxInst of parent.myIndexInstances) {
      $.indexRemove(idxInst, rec);
   }

   return true;
}
addFact ::= function (rel, rkey, rval) {
   $.check(rel.isKeyed === (rval !== undefined));
   $.check(!rel.records.has(rkey), `Duplicate record`);

   let rec = rel.recType === $.RecordType.tuple ? rkey : [rkey, rval];

   $.addRec(rel, rec);
   
   $.invalidate(rel);
}
removeFact ::= function (rel, rkey) {
   let removed = $.deleteRecByKey(rel, rkey);
   
   $.check(removed, `Missing record`);
   
   $.invalidate(rel);
}
changeFact ::= function (rel, rkey, newValue) {
   $.check(
      rel.isKeyed,
      `Cannot change fact in a relation that does not have primary key`
   );
   
   let removed = $.deleteRecByKey(rel, rkey);

   $.check(removed, `Missing record`);

   $.addRec(rel, [rkey, newValue]);

   $.invalidate(rel);
}
invalidate ::= function (rel) {
   $.invalidateProjections(...rel.validRevDeps);
   rel.validRevDeps.clear();
}
