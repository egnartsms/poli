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
   normalizeAttrs
dedb-version
   refCurrentState
   isVersionFresh
   versionAdd
   versionRemove
   unchainVersion
   releaseVersion
dedb-index
   copyIndex
   rebuildIndex
   indexAdd
   indexRemove
   indexAt
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
   recType,
   isEntity=false,
   attrs: plainAttrs=[],
   indices=[],
   records=[]
}) {
   let attrs = $.normalizeAttrs(recType, plainAttrs);

   let indexInstances = $.indexInstanceStorage();
   let availableIndices = [];

   for (let index of indices) {
      if (index.isUnique) {
         let idxInst = $.copyIndex(index);

         idxInst.owner = null;  // will set to the relation object below
         idxInst.refCount = 1;  // always kept alive

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
      attrs,
      indices: availableIndices,
      projmap: new Map,
      myVer: null,
      records: null,  // intialized below
      myIndexInstances: indexInstances,  // shared with the full projection
      validRevDeps: new Set,  // 'revdeps' here means projections
      entityProto: false,  // initialize below if necessary

      at(attrs) {
         return $.relGoal(this, attrs);
      },
   });

   rel.records = $.makeRecords(rel, records);

   for (let idxInst of indexInstances) {
      idxInst.owner = rel;
      $.rebuildIndex(idxInst, records);
   }

   if (isEntity) {
      rel.entityProto = $.makeEntityPrototype(rel);
   }

   return rel;
}
filterRelationRecords ::= function (rel, boundAttrs) {
   if (rel.isKeyed && $.hasOwnProperty(boundAttrs, $.recKey)) {
      let rec = rel.recAt(boundAttrs[$.recKey]);
      return (rec === undefined) ? [] : [rec];
   }

   for (let idxInst of rel.myIndexInstances) {
      if ($.all(idxInst, attr => $.hasOwnProperty(boundAttrs, attr))) {
         return $.map(
            $.indexAt(idxInst, Array.from(idxInst, a => boundAttrs[a])),
            rkey => rel.recAt(rkey)
         );
      }
   }

   // no suitable index found => revert to full scan
   return $.filter(rel.records, rec => $.recSatisfies(boundAttrs, rec));
}
recSatisfies ::= function (boundAttrs, rec) {
   return $.all($.ownEntries(boundAttrs), ([attr, val]) => {
      return proj.recAttr(rec, attr) === val;
   });
}
makeProjection ::= function (rel, boundAttrs) {
   let proj;

   // We want to preserve the same shape for the full projection and partial ones
   // (for V8 optimizations).
   if ($.hasNoEnumerableProps(boundAttrs)) {
      proj = $.newObj($.recTypeProto(rel.recType), {
         rel: rel,
         refCount: 0,
         isValid: true,
         boundAttrs: boundAttrs,
         depVer: null,  // always null
         myVer: null,  // always null
         records: rel.records,  // shared
         myIndexInstances: rel.myIndexInstances,  // shared
         validRevDeps: new Set
      });
   }
   else {
      proj = $.newObj($.recTypeProto(rel.recType), {
         rel: rel,
         refCount: 0,
         isValid: true,
         boundAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         records: null,  // initialized below
         myIndexInstances: $.indexInstanceStorage(),
         validRevDeps: new Set
      });

      proj.records = $.makeRecords(
         proj,
         $.filterRelationRecords(rel, boundAttrs)
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
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if ($.isFullProjection(proj) || $.isVersionFresh(proj.depVer)) {
      $.markProjectionValid(proj);
      return;
   }

   $.unchainVersion(proj.depVer);

   for (let rkey of proj.depVer.removed) {
      $.removeRecByKey(proj, rkey);
   }
   
   for (let rkey of proj.depVer.added) {
      let rec = proj.rel.recAt(rkey);

      if ($.recSatisfies(proj.boundAttrs, rec)) {
         $.addRec(proj, rec);
      }
   }

   let newDepVer = $.refCurrentState(proj.rel);
   $.releaseVersion(proj.depVer);
   proj.depVer = newDepVer;

   $.markProjectionValid(proj);
}
addRec ::= function (parent, rec) {
   // 'parent' is either a base relation or a non-full projection thereof
   parent.addRecord(rec);

   if (parent.myVer !== null) {
      $.versionAdd(parent.myVer, rec);
   }

   for (let idxInst of parent.myIndexInstances) {
      $.indexAdd(idxInst, rec);
   }
}
addRecToRel ::= function (rel, rec) {
   $.addRec(rel, rec);

   if (rel.entityProto !== false) {
      let [entity, tuple] = rec;

      entity[$.symEntityTuple] = tuple;
   }
}
removeRecByKey ::= function (parent, rkey) {
   let rec = parent.recAt(rkey);

   if (rec === undefined) {
      return false;
   }

   parent.records.delete(rkey);

   if (parent.myVer !== null) {
      $.versionRemove(parent.myVer, rec);
   }

   for (let idxInst of parent.myIndexInstances) {
      $.indexRemove(idxInst, rec);
   }

   return true;
}
removeRecByKeyFromRel ::= function (rel, rkey) {
   let removed = $.removeRecByKey(rel, rkey);

   if (removed && rel.entityProto !== false) {
      let entity = rkey;

      entity[$.symEntityTuple] = null;
   }

   return removed;
}
addFact ::= function (rel, rkey, rval) {
   $.check(rel.isKeyed === (rval !== undefined));
   $.check(!rel.records.has(rkey), `Duplicate record`);

   let rec = rel.isKeyed ? [rkey, rval] : rkey;

   $.addRecToRel(rel, rec);
   
   $.invalidate(rel);
}
removeFact ::= function (rel, rkey) {
   let removed = $.removeRecByKeyFromRel(rel, rkey);
   
   $.check(removed, `Missing record`);
   
   $.invalidate(rel);
}
changeFact ::= function (rel, rkey, newValue) {
   $.check(rel.isKeyed, `Cannot change fact in a non-keyed relation`);
   
   let removed = $.removeRecByKey(rel, rkey);

   $.check(removed, `Missing record`);

   $.addRec(rel, [rkey, newValue]);

   if (rel.entityProto !== false) {
      let entity = rkey;

      entity[$.symEntityTuple] = newValue;
   }

   $.invalidate(rel);
}
invalidate ::= function (rel) {
   $.invalidateProjections(...rel.validRevDeps);
   rel.validRevDeps.clear();
}
makeEntityPrototype ::= function (rel) {
   $.assert(() => rel.recType === $.RecordType.keyTuple);

   let proto = {
      [$.symEntityRelation]: rel
   };

   for (let attr of rel.attrs.slice(1)) {
      Object.defineProperty(proto, attr, {
         configurable: true,
         enumerable: true,
         get() {
            return this[$.symEntityTuple][attr];
         }
      });
   }

   return proto;
}
symEntityTuple ::= Symbol.for('poli.entityTuple')
symEntityRelation ::= Symbol.for('poli.entityRelation')
makeEntity ::= function (rel, tuple) {
   let entity = Object.create(rel.entityProto);

   entity[$.symEntityTuple] = tuple;
   $.addFact(rel, entity, tuple);

   return entity;
}
removeEntity ::= function (entity) {
   $.removeFact(entity[$.symEntityRelation], entity);
   entity[$.symEntityTuple] = null;
}
setEntity ::= function (entity, newTuple) {
   $.changeFact(entity[$.symEntityRelation], entity, newTuple);
   entity[$.symEntityTuple] = newTuple;
}
patchEntity ::= function (entity, fn, ...args) {
   let newTuple = fn(entity[$.symEntityTuple], ...args);
   $.setEntity(entity, newTuple);
}
revertTo ::= function (extVer) {
   let baserel = extVer.owner;

   if (baserel.isKeyed) {
      for (let rkey of extVer.added.keys()) {
         $.removeRecByKeyFromRel(baserel, rkey);
      }

      for (let rec of extVer.removed) {
         $.addRecToRel(baserel, rec);
      }
   }
   else {
      for (let rec of extVer.added) {
         $.removeRecByKeyFromRel(baserel, rec);
      }

      for (let rec of extVer.removed) {
         $.addRecToRel(baserel, rec);
      }
   }
}