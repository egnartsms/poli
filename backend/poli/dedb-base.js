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
   maximumBy
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
   unique
   isIndexFullHit
dedb-index-instance
   rebuildIndex
   indexAdd
   indexRemove
   makeIndexInstance
   indexRefUnique
   indexRef
   indexRefWithBindings
   indexHitScore
dedb-projection
   invalidateProjections
dedb-goal
   relGoal
dedb-relation
   RelationType
   getRelevantProto
dedb-common
   RecordType
   recTypeProto
   makeRecords
-----
makeRelation ::= function ({
   name,
   isKeyed=false,
   isEntity=false,
   attrs=[],
   indices: indexSpecs = [],
   records = []
}) {
   $.check(!isEntity || isKeyed);
   $.check(isKeyed || attrs.length > 0);

   let rel = {
      type: $.RelationType.base,
      name,
      attrs,
      isKeyed,
      indices: null,   // initialized below
      projmap: new Map,
      myVer: null,
      records: new (isKeyed ? Map : Set)(records),
      validRevDeps: new Set,  // 'revdeps' here means projections
      entityProto: false,  // initialized below if necessary
   };

   let indices = [];

   for (let spec of indexSpecs) {
      let index;

      if (spec[spec.length - 1] === $.unique) {
         index = $.makeIndexInstance(spec.slice(0, -1), {isUnique: true, isKeyed});
      }
      else {
         index = $.makeIndexInstance(spec, {isUnique: false, isKeyed});
      }

      $.rebuildIndex(index, rel.records.entries());
      
      indices.push(index);
   }

   rel.indices = indices;

   if (isEntity) {
      rel.entityProto = $.makeEntityPrototype(rel);
   }

   return rel;
}
getUniqueRecord ::= function (rel, bindings) {
   let boundAttrs = Object.keys(bindings);
   let index = $.findUniqueIndex(rel, boundAttrs);

   $.check(index !== undefined, `Could not find suitable unique index`);

   let rec = $.indexRefUnique(index, $.map(index.attrs, a => bindings[a]));

   if (rec !== undefined && index.attrs.length < boundAttrs.length) {
      let recVal = rel.isKeyed ? rec[1] : rec;

      for (let attr of boundAttrs) {
         if (!index.attrs.includes(attr) && recVal[attr] !== bindings[attr]) {
            rec = undefined;
            break;
         }
      }
   }

   return rec;
}
getRecords ::= function (rel, bindings) {
   let boundAttrs = Object.keys(bindings);
   let index = $.findSuitableIndex(rel, boundAttrs);

   $.check(index !== undefined, `Could not find suitable index`);

   let recs = $.indexRefWithBindings(index, bindings);

   let filterBy = [];

   for (let attr of boundAttrs) {
      if (!index.attrs.includes(attr)) {
         filterBy.push([attr, bindings[attr]]);
      }
   }

   return filterBy.length === 0 ? recs : $.filter(recs, rec => {
      let recVal = rel.isKeyed ? rec[1] : rec;

      for (let [attr, val] of filterBy) {
         if (recVal[attr] !== val) {
            return false;
         }
      }

      return true;
   });
}
findUniqueIndex ::= function (rel, boundAttrs) {
   return rel.indices.find(index => {
      return index.isUnique && $.isIndexFullHit(index.attrs, boundAttrs);
   });
}
findSuitableIndex ::= function (rel, boundAttrs) {
   return $.maximumBy(rel.indices, 0, index => $.indexHitScore(index, boundAttrs));
}
recValSatisfies ::= function (recVal, filterBindings) {
   for (let [attr, val] of filterBindings) {
      if (recVal[attr] !== val) {
         return false;
      }
   }

   return true;
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
   return $.filter(rel.records, rec => $.recSatisfies(rel, rec, boundAttrs));
}
recSatisfies ::= function (parent, rec, boundAttrs=parent.boundAttrs) {
   return $.all($.ownEntries(boundAttrs), ([attr, val]) => {
      return parent.recAttr(rec, attr) === val;
   });
}
recKeyProjectionProto ::= ({
   
})
makeRecKeyBoundProjection ::= function (rel, recKey, boundAttrs) {
   return {
      rel,
      refCount: 0,
      isValid: true,
      recKey,
      boundAttrs,
      myVer: null,
      recVal: rel.records.valueAt(recKey),
      validRevDeps: new Set
   }
}
makeUniqueIndexHitProjection ::= function (rel, inst, values, boundAttrs) {
   return {
      rel,
      refCount: 0,
      isValid: true,
      indexInstance: inst,
      indexValues: values,
      boundAttrs,
      myVer: null,
      record: 0,
      validRevDeps: new Set
   }
}
makeProjection ::= function (rel, recKey, boundAttrs) {
   if (recKey !== undefined) {
      return $.makeRecKeyBoundProjection(rel, recKey, boundAttrs);
   }

   let boundList = Object.keys(boundAttrs);
   let coveredInstances = rel.indices.filter(inst => {
      return $.isIndexHit(inst.attrs, boundList);
   });

   if (coveredInstances.length === 0) {
      // projection that does not know its records, only the delta
      return {
         rel: rel,
         refCount: 0,
         isValid: true,
         filterAttrs: boundAttrs,
         depVer: $.refCurrentState(rel),
         myVer: null,
         validRevDeps: new Set
      }
   }

   coveredInstances.sort((inst1, inst2) => {
      if (inst1.isUnique) {
         return -1;
      }
      if (inst2.isUnique) {
         return 1;
      }

      return inst1.attrs.length - inst2.attrs.length;
   });

   if (coveredInstances[0].isUnique) {
      return $.makeUniqueIndexHitProjection();
   }

   return $.makeIndexHitProjection();

   // return {
   //    rel,
   //    refCount: 0,
   //    isValid: true,
   //    index: index,
   //    filterAttrs: $.allOtherBoundAttrs(boundAttrs),
   //    validRevDeps: new Set
   // };

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
updateFixedKeyProjection ::= function (proj) {
   let {rel} = proj;

   let recVal = rel.records.get(proj.fixedKey);

}
updateProjection ::= function (proj) {
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