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
   selectProps
   trackingFinal
prolog-shared
   recKey
   recVal
   recAttr
   normalizeAttrsForPk
   recKeyOf
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
prolog-index-instance
   indexInstanceStorage
prolog-projection
   invalidateProjections
   makeRecords
prolog-shared
   Keyed
-----
baseRelation ::= function ({
   name,
   attrs,
   hasPrimaryKey=false,
   indices,
   records=[]
}) {
   let keyed;

   ({keyed, attrs} = $.normalizeAttrsForPk(attrs, hasPrimaryKey, name));

   records = $.makeRecords(records, hasPrimaryKey);

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
         keyed: rel.keyed,
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
         keyed: rel.keyed,
         boundAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         records: null,
         indexInstances: $.indexInstanceStorage(),
         validRevDeps: new Set,
      };

      proj.records = $.makeRecords(
         $.filter(rel.records, rec => $.recSatisfies(proj, rec)),
         rel.keyed
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
      return $.recAttr(rec, attr, proj.keyed) === proj.boundAttrs[attr];
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
         $.assert(() => proj.keyed);

         let newValue = proj.rel.records.get(recKey);
         $.assert(() => newValue !== undefined);
         let newRec = [recKey, newValue];

         if (proj.records.has(recKey)) {
            $.deleteRecByKey(proj, recKey);
         }

         if ($.recSatisfies(proj, newRec)) {
            $.addRec(proj, newRec);
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
      $.deltaAppend(parent.myVer.delta, parent.keyed, $.recKeyOf(parent, rec), 'add');
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
      $.deltaAppend(parent.myVer.delta, parent.keyed, recKey, 'remove');
   }

   for (let idxInst of parent.indexInstances) {
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
