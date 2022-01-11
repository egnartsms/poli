common
   all
   arraysEqual
   assert
   check
   filter
   find
   hasNoEnumerableProps
   hasOwnProperty
   hasOwnDefinedProperty
   concat
   map
   maximumBy
   ownEntries
   newObj
   selectProps
   trackingFinal
data-structures
   ExpRecords
   ImpRecords
dedb-rec-key
   recKey
   recVal
   normalizeAttrs
dedb-version
   refCurrentState
   releaseVersion
   multiVersionAddKey
   multiVersionRemoveKey
   multiVersionRemovePair
   unchainVersion
dedb-index
   unique
   indexKeys
   uniqueIndexFullHit
   indexFitness
   indexFromSpec
   Fitness
dedb-index-instance
   rebuildIndex
   indexAdd
   indexRemove
   makeIndexInstance
   indexRefOne
   indexRefWithBindings
   indexRefOneWithBindings
dedb-projection
   invalidateProjections
   makeProjectionRegistry
dedb-relation
   toRelation
   rec2val
   rec2pair
-----
clsBaseRelation ::= ({
   name: 'relation.base',
   'relation.base': true,
   'relation': true,
})
makeRelation ::= function ({
   name,
   isKeyed = false,
   isEntity = false,
   attrs = [],
   indices: indexSpecs = [],
   records = []
}) {
   $.check(!isEntity || isKeyed);
   $.check(isKeyed || attrs.length > 0);

   let rel = {
      class: $.clsBaseRelation,
      name,
      attrs,
      virtualAttrs: [$.recKey, ...attrs],
      isKeyed,
      myIndexInstances: null,   // initialized below
      projections: $.makeProjectionRegistry(),
      myVer: null,
      records: new (isKeyed ? $.ExpRecords : $.ImpRecords)(records),
      validRevDeps: new Set,  // 'revdeps' here means projections
      entityProto: false,  // initialized below if necessary
   };

   let instances = [];

   for (let spec of indexSpecs) {
      let index = $.indexFromSpec(spec);
      let inst = $.makeIndexInstance(rel, index);

      $.rebuildIndex(inst, rel.records);

      instances.push(inst);
   }

   rel.myIndexInstances = instances;

   if (isEntity) {
      rel.entityProto = $.makeEntityPrototype(rel);
   }

   return rel;
}
getUniqueRecord ::= function (rel, bindings) {
   let boundAttrs = Object.keys(bindings);
   let inst = $.findUniqueIdxInst(rel, boundAttrs);

   $.check(inst !== undefined, `Could not find suitable unique index`);

   let rec = $.indexRefOneWithBindings(inst, bindings);

   if (rec !== undefined && inst.index.length < boundAttrs.length) {
      let recVal = rel.isKeyed ? rec[1] : rec;

      for (let attr of boundAttrs) {
         if (!inst.index.includes(attr) && recVal[attr] !== bindings[attr]) {
            rec = undefined;
            break;
         }
      }
   }

   return rec;
}
getRecords ::= function (rel, bindings) {
   let inst = $.findSuitableIdxInst(rel, Object.keys(bindings));

   $.check(inst !== undefined, `Could not find suitable index`);

   let recs = $.indexRefWithBindings(inst, bindings);
   let filterBy = $.computeFilterBy(inst.index, bindings);

   return $.filter(recs, $.predFilterBy(rel.isKeyed, filterBy));
}
findUniqueIdxInst ::= function (rel, boundAttrs) {
   return rel.myIndexInstances.find(({index}) => $.uniqueIndexFullHit(index, boundAttrs));
}
findSuitableIdxInst ::= function (rel, boundAttrs) {
   let inst = $.maximumBy(
      rel.myIndexInstances, ({index}) => $.indexFitness(index, boundAttrs)
   );

   if (inst === undefined ||
         $.indexFitness(inst.index, boundAttrs) === $.Fitness.minimum) {
      return undefined;
   }

   return inst;
}
computeFilterBy ::= function (index, bindings) {
   let filterBy = {...bindings};

   for (let attr of index) {
      if (!$.hasOwnDefinedProperty(bindings, attr)) {
         break;
      }

      delete filterBy[attr];
   }
   
   return Object.entries(filterBy);
}
suitsFilterBy ::= function (rval, filterBy) {
   for (let [attr, val] of filterBy) {
      if (rval[attr] !== val) {
         return false;
      }
   }

   return true;
}
predFilterBy ::= function (isKeyed, filterBy) {
   if (isKeyed) {
      return ([rkey, rval]) => $.suitsFilterBy(rval, filterBy);
   }
   else {
      return rec => $.suitsFilterBy(rec, filterBy);
   }
}
clsBaseProjection ::= ({
   name: 'projection.base',
   'projection.base': true,
   'projection': true
})
clsRecKeyBoundProjection ::= ({
   name: 'projection.base.recKeyBound',
   'projection.base.recKeyBound': true,
   'projection.base': true,
   'projection': true
})
clsUniqueHitProjection ::= ({
   name: 'projection.base.uniqueIndexHit',
   'projection.base.uniqueIndexHit': true,
   'projection.base': true,
   'projection': true
})
clsHitProjection ::= ({
   name: 'projection.base.indexHit',
   'projection.base.indexHit': true,
   'projection.base': true,
   'projection': true
})
clsNoHitProjection ::= ({
   name: 'projection.base.noIndex',
   'projection.base.noIndex': true,
   'projection.base': true,
   'projection': true
})
clsFullProjection ::= ({
   name: 'projection.base.full',
   'projection.base.full': true,
   'projection.base': true,
   'projection': true
})
makeProjection ::= function (rel, bindings) {
   let proj = {
      class: null,  // initialized below
      rel,
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
   };

   if (bindings[$.recKey] !== undefined) {
      let rkey = bindings[$.recKey];

      proj.class = $.clsRecKeyBoundProjection;
      proj.rkey = rkey;
      proj.rval = undefined;
      proj.filterBy = Object.entries(bindings);
   }
   else {
      let inst = $.findSuitableIdxInst(rel, Object.keys(bindings));

      if (inst === undefined) {
         let filterBy = Object.entries(bindings);
         
         if (filterBy.length === 0) {
            proj.class = $.clsFullProjection;
            Object.defineProperty(proj, 'myVer', {
               configurable: true,
               enumerable: true,
               get() {
                  return this.rel.myVer;
               }
            })
         }
         else {
            proj.class = $.clsNoHitProjection;
            proj.myVer = null;
            proj.depVer = null;
            proj.filterBy = filterBy;
         }
      }
      else {
         proj.indexInstance = inst;
         proj.indexKeys = $.indexKeys(inst.index, bindings);

         if (inst.isUnique) {
            proj.class = $.clsUniqueHitProjection;
            proj.filterBy = $.computeFilterBy(inst.index, bindings);
            proj.rec = undefined;
         }
         else {
            proj.class = $.clsHitProjection;
            proj.filterBy = Object.entries(bindings);
            proj.filterIndexedBy = $.computeFilterBy(inst.index, bindings);
            proj.myVer = null;
            proj.depVer = null;
         }
      }
   }

   $.updateProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   proj.rel.validRevDeps.delete(proj);
}
markAsValid ::= function (proj) {
   proj.isValid = true;
   proj.rel.validRevDeps.add(proj);
}
updateProjection ::= function (proj) {
   let {rel, class: cls} = proj;

   if (cls === $.clsFullProjection)
      ;
   else if (cls === $.clsRecKeyBoundProjection) {
      let rval = rel.records.valueAt(proj.rkey);

      if (rval !== undefined && !$.suitsFilterBy(rval, proj.filterBy)) {
         rval = undefined;
      }

      proj.rval = rval;
   }
   else if (cls === $.clsUniqueHitProjection) {
      let rec = $.indexRefOne(proj.indexInstance, proj.indexKeys);

      if (rec !== undefined && rec !== proj.rec &&
            !$.suitsFilterBy($.rec2val(proj, rec), proj.filterBy)) {
         rec = undefined;
      }

      proj.rec = rec;
   }
   else if (cls === $.clsHitProjection || cls === $.clsNoHitProjection) {
      $.assert(() => (proj.depVer === null) === (proj.myVer === null));

      if (proj.depVer !== null) {
         $.unchainVersion(proj.depVer);

         for (let [rkey, rval] of proj.depVer.removed.entries()) {
            if ($.suitsFilterBy(rval, proj.filterBy)) {
               $.multiVersionRemoveKey(proj.myVer, rkey);
            }
         }

         for (let rkey of proj.depVer.added) {
            let rval = rel.records.valueAtX(rkey);

            if ($.suitsFilterBy(rval, proj.filterBy)) {
               $.multiVersionAddKey(proj.myVer, rkey);
            }
         }
         
         let newDepVer = $.refCurrentState(rel);
         $.releaseVersion(proj.depVer);
         proj.depVer = newDepVer;
      }
   }
   else {
      throw new Error;
   }

   $.markAsValid(proj);
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
addFact ::= function (relInfo, rkey, rval=rkey) {
   let rel = $.toRelation(relInfo);

   $.check(rel.isKeyed || rkey === rval, `Keyed/non-keyed misuse`);
   $.check(!rel.records.hasAt(rkey), `Duplicate record`);

   rel.records.addPair(rkey, rval);

   if (rel.myVer !== null) {
      $.multiVersionAddKey(rel.myVer, rkey);
   }

   for (let inst of rel.myIndexInstances) {
      $.indexAdd(inst, rkey, rval);
   }
   
   if (rel.entityProto !== false) {
      rkey[$.symEntityTuple] = rval;
   }

   $.invalidate(rel);
}
removeFact ::= function (relInfo, rkey) {
   let rel = $.toRelation(relInfo);
   let rval = rel.records.valueAt(rkey);

   if (rval === undefined) {
      throw new Error(`Missing record`);
   }

   $.doRemove(rel, rkey, rval);
   $.invalidate(rel);
}
doRemove ::= function (rel, rkey, rval) {
   rel.records.removeAt(rkey);

   if (rel.myVer !== null) {
      $.multiVersionRemovePair(rel.myVer, rkey, rval);
   }

   for (let inst of rel.myIndexInstances) {
      $.indexRemove(inst, rkey, rval);
   }

   if (rel.entityProto !== false) {
      rkey[$.symEntityTuple] = null;
   }
}
removeIf ::= function (relInfo, pred) {
   let rel = $.toRelation(relInfo);

   let toRemove = Array.from($.filter(rel.records, pred));

   for (let rec of toRemove) {
      let [rkey, rval] = $.rec2pair(rel, rec);
      $.doRemove(rel, rkey, rval);
   }

   $.invalidate(rel);
}
changeFact ::= function (relInfo, rkey, rvalNew) {
   let rel = $.toRelation(relInfo);

   $.check(rel.isKeyed, `Cannot change fact in a non-keyed relation`);
   
   $.removeFact(rel, rkey);
   $.addFact(rel, rkey, rvalNew);
}
invalidate ::= function (rel) {
   $.invalidateProjections(rel.validRevDeps);
   rel.validRevDeps.clear();
}
makeEntityPrototype ::= function (rel) {
   let proto = {
      [$.symEntityRelation]: rel
   };

   for (let attr of rel.attrs) {
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
makeEntity ::= function (relInfo, tuple) {
   let rel = $.toRelation(relInfo);
   let entity = Object.create(rel.entityProto);

   entity[$.symEntityTuple] = tuple;
   $.addFact(rel, entity, tuple);

   return entity;
}
removeEntity ::= function (entity) {
   $.removeFact(entity[$.symEntityRelation], entity);
}
setEntity ::= function (entity, newTuple) {
   $.changeFact(entity[$.symEntityRelation], entity, newTuple);
}
patchEntity ::= function (entity, fn, ...args) {
   let newTuple = fn(entity[$.symEntityTuple], ...args);
   $.setEntity(entity, newTuple);
}
revertTo ::= function (extVer) {
   throw new Error;

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