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
   chain
   map
   mapfilter
   greatestBy
   ownEntries
   newObj
   noUndefinedProps
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
   refRelationState
   releaseVersion
   versionAdd
   versionRemove
   prepareVersion
dedb-index
   unique
   indexKeys
   isUniqueHitByBindings
   indexFitnessByBindings
   indexFromSpec
   Fitness
dedb-index-instance
   rebuildIndex
   indexAdd
   indexRemove
   makeIndexInstance
   indexRef
   indexRefWithBindings
dedb-projection
   invalidate
   makeProjectionRegistry
dedb-relation
   rec2val
   rec2pair
-----
baseRelation ::= function ({
   name,
   entityProto = null,
   attrs = [],
   indices: indexSpecs = [],
   records = []
}) {
   let rel = {
      kind: 'base',
      name,
      attrs,
      myInsts: [],   // initialized below
      projections: $.makeProjectionRegistry(),
      myVer: null,
      records: new Set(records),
      validRevDeps: new Set,  // 'revdeps' here means projections
      entityProto: entityProto,
   };

   for (let spec of indexSpecs) {
      let index = $.indexFromSpec(spec);
      let inst = $.makeIndexInstance(rel, index);

      inst.refCount += 1;  // this guarantees that 'inst' will always be alive

      $.rebuildIndex(inst, rel.records);

      rel.myInsts.push(inst);
   }

   if (entityProto !== null) {
      $.setupEntityPrototype(rel, entityProto);
   }

   return rel;
}
getUniqueRecord ::= function (rel, bindings) {
   let inst = $.findUniqueIdxInst(rel, bindings);

   $.check(inst !== undefined, `Could not find suitable unique index`);

   let [rec] = $.indexRefWithBindings(inst, bindings);

   if (rec === undefined) {
      return undefined;
   }

   let boundAttrs = Object.keys(bindings);

   if (inst.index.length < boundAttrs.length) {
      for (let attr of boundAttrs) {
         if (!inst.index.includes(attr) && rec[attr] !== bindings[attr]) {
            return undefined;
         }
      }
   }

   return rec;
}
getRecords ::= function (rel, bindings) {
   let inst = $.findSuitableIdxInst(rel, bindings);

   $.check(inst !== undefined, `Could not find suitable index`);

   let recs = $.indexRefWithBindings(inst, bindings);
   let filterBy = $.computeFilterBy(bindings, inst.index);

   if (filterBy.length === 0) {
      return recs;
   }

   return $.filter(recs, rec => $.suitsFilterBy(rec, filterBy));
}
findUniqueIdxInst ::= function (rel, bindings) {
   return rel.myInsts.find(({index}) => $.isUniqueHitByBindings(index, bindings))
}
findSuitableIdxInst ::= function (rel, bindings) {
   let [inst, fitness] = $.greatestBy(
      rel.myInsts,
      ({index}) => $.indexFitnessByBindings(index, bindings)
   );

   return (fitness > $.Fitness.minimum) ? inst : undefined;
}
computeFilterBy ::= function (bindings, exceptAttrs=[]) {
   return Object.entries(bindings).filter(([attr, val]) => !exceptAttrs.includes(attr));
}
suitsFilterBy ::= function (rec, filterBy) {
   for (let [attr, val] of filterBy) {
      if (rec[attr] !== val) {
         return false;
      }
   }

   return true;
}
makeProjection ::= function (rel, bindings) {
   bindings = $.noUndefinedProps(bindings);

   let proj = {
      kind: '',  // initialized below
      rel,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      fullRecords: rel.records,
   };

   let inst = $.findSuitableIdxInst(rel, bindings);

   if (inst !== undefined && inst.index.isUnique) {
      proj.kind = 'unique-hit';
      proj.inst = inst;
      proj.keys = $.indexKeys(inst.index, bindings);
      proj.filterBy = $.computeFilterBy(bindings, inst.index);
      proj.rec = undefined;
   }
   else {
      let filterBy = $.computeFilterBy(bindings);
      
      if (inst === undefined && filterBy.length === 0) {
         proj.kind = 'full';
         Object.defineProperty(proj, 'myVer', {
            configurable: true,
            enumerable: true,
            get() {
               return this.rel.myVer;
            }
         })
      }
      else {
         proj.kind = 'partial';
         proj.myVer = null;
         proj.depVer = null;
         proj.filterBy = filterBy;
      }
   }

   $.updateProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   proj.rel.validRevDeps.delete(proj);
}
markAsValid ::= function (proj) {
   proj.rel.validRevDeps.add(proj);
   proj.isValid = true;
}
updateProjection ::= function (proj) {
   let {rel, kind} = proj;

   if (kind === 'full')
      ;
   else if (kind === 'unique-hit') {
      let {inst, keys, filterBy} = proj;
      let [rec] = $.indexRef(inst, keys);

      if (rec !== undefined && !$.suitsFilterBy(rec, filterBy)) {
         rec = undefined;
      }
      
      proj.rec = rec;
   }
   else if (kind === 'partial') {
      $.assert(() => (proj.depVer === null) === (proj.myVer === null));

      if (proj.depVer !== null) {
         $.prepareVersion(proj.depVer);

         for (let rec of proj.depVer.removed) {
            if ($.suitsFilterBy(rec, proj.filterBy)) {
               $.versionRemove(proj.myVer, rec);
            }
         }

         for (let rec of proj.depVer.added) {
            if ($.suitsFilterBy(rec, proj.filterBy)) {
               $.versionAdd(proj.myVer, rec);
            }
         }

         let newDepVer = $.refRelationState(rel);
         $.releaseVersion(proj.depVer);
         proj.depVer = newDepVer;
      }
   }
   else {
      throw new Error;
   }

   $.markAsValid(proj);
}
addFact ::= function (rel, rec) {
   $.check(!rel.records.has(rec), `Duplicate record`);

   rel.records.add(rec);

   if (rel.myVer !== null) {
      $.versionAdd(rel.myVer, rec);
   }

   for (let inst of rel.myInsts) {
      $.indexAdd(inst, rec);
   }
   
   // if (rel.entityProto !== null) {
   //    rkey[$.symTuple] = rval;
   // }

   $.invalidate(rel);
}
removeFact ::= function (rel, rec) {
   if (!rel.records.has(rec) === undefined) {
      throw new Error(`Missing record`);
   }

   $.doRemove(rel, rec);
   $.invalidate(rel);
}
removeIf ::= function (rel, pred) {
   let toRemove = Array.from($.filter(rel.records, pred));

   for (let rec of toRemove) {
      $.doRemove(rel, rec);
   }

   $.invalidate(rel);
}
replaceWhere ::= function (rel, bindings, replacer) {
   let recs = Array.from($.getRecords(rel, bindings));

   for (let rec of recs) {
      let newRec = replacer(rec);

      if (newRec !== undefined) {
         $.removeFact(rel, rec);
         $.addFact(rel, newRec);
      }
   }
}
doRemove ::= function (rel, rec) {
   rel.records.delete(rec);

   if (rel.myVer !== null) {
      $.versionRemove(rel.myVer, rec);
   }

   for (let inst of rel.myInsts) {
      $.indexRemove(inst, rec);
   }

   // if (rel.entityProto !== null) {
   //    rkey[$.symTuple] = null;
   // }
}
symTuple ::= Symbol.for('poli.tuple')
symRelation ::= Symbol.for('poli.relation')
setupEntityPrototype ::= function (rel) {
   rel.entityProto[$.symRelation] = rel;

   for (let attr of rel.attrs) {
      Object.defineProperty(rel.entityProto, attr, {
         configurable: true,
         enumerable: true,
         get() {
            return this[$.symTuple][attr];
         }
      });
   }
}
makeEntity ::= function (rel, tuple) {
   let entity = Object.create(rel.entityProto);

   $.addFact(rel, entity, tuple);

   return entity;
}
removeEntity ::= function (entity) {
   $.removeFact(entity[$.symRelation], entity);
}
setEntity ::= function (entity, newTuple) {
   $.changeFact(entity[$.symRelation], entity, newTuple);
}
patchEntity ::= function (entity, fn, ...args) {
   let newTuple = fn(entity[$.symTuple], ...args);
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