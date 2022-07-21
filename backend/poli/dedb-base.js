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
   emptyIndex
   unique
   tupleKeys
   isUniqueHitByBindings
   tupleFitnessByBindings
   tupleFromSpec
   Fitness
   findSuitableIndex
   rebuildIndex
   indexAdd
   indexRemove
   makeIndex
   indexRef
   indexRefWithBindings

dedb-projection
   invalidateProjection
   makeProjectionRegistry

dedb-relation
   rec2val
   rec2pair

dedb-query
   getRecords

-----

baseRelation ::=
   function ({
      name,
      attrs,
      protoEntity = null,
      indices: indexSpecs = []
   }) {
      let rel = {
         kind: 'base',
         name,
         attrs,
         protoEntity,
         recSym: protoEntity !== null ? Symbol(name) : null,
         indices: [],
         projections: new Map,
         myVer: null,
         records: new Set,
         validRevDeps: new Set,
      };

      for (let spec of indexSpecs) {
         let tuple = $.tupleFromSpec(spec);
         let index = $.makeIndex(rel, tuple);

         index.refCount += 1;  // 'index' is going to be around forever

         rel.indices.push(index);
      }

      if (protoEntity !== null) {
         $.populateProtoEntity(rel);
      }

      return rel;
   }


populateProtoEntity ::=
   function (rel) {
      let {protoEntity, recSym} = rel;

      for (let attr of rel.attrs) {
         $.check(!Object.hasOwn(protoEntity, attr), () =>
            `Relation '${rel.name}': property '${attr}' already defined on the prototype`
         );

         Object.defineProperty(rel.protoEntity, attr, {
            configurable: true,
            enumerable: true,
            get() {
               return this[recSym][attr];
            }
         })
      }
   }


relationChanged ::=
   function (rel) {
      for (let proj of rel.validRevDeps) {
         $.invalidateProjection(proj);
      }

      rel.validRevDeps.clear();
   }


entity ::=
   :This symbol is used for 2 purposes:
      - bindings[$.entity] === <entity object>
      - record[$.entity] === <entity object>
   Symbol('entity')


makeProjection ::=
   function (rel, bindings) {
      let proj = {
         kind: '',  // initialized below
         rel,
         refCount: 0,
         myKey: '',   // set by the calling code
         isValid: false,
         validRevDeps: new Set,
      };

      if (Object.hasOwn(bindings, $.entity)) {
         $.check(rel.protoEntity !== null);

         proj.kind = 'entity';
         proj.entity = bindings[$.entity];
         proj.checkList = $.computeCheckList(bindings, [$.entity]);
         // either the current record for `entity` or null if it does not satisfy
         // `filterBy` or is deleted. The `rec` property is also used in the 'unique-hit'
         // projection kind with exactly the same meaning.
         proj.rec = null;
      }
      else {
         let [index, fitness] = $.findSuitableIndex(rel.indices, bindings);

         if (fitness === $.Fitness.uniqueHit) {
            proj.kind = 'unique-hit';
            proj.index = index;
            proj.keys = $.tupleKeys(index.tuple, bindings);
            proj.checkList = $.computeCheckList(bindings, index.tuple);
            proj.rec = null;
         }
         else {
            let checkList = $.computeCheckList(bindings);

            if (checkList.length === 0) {
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
               // TODO: we might as well save the fact that there is a non-unique index
               // hit. This is for the derived computation algorithm to start with
               // (`rebuildProjection`).  For now, this is not done.
               proj.kind = 'partial';
               proj.myVer = null;
               proj.depVer = null;
               proj.checkList = checkList;
            }
         }
      }

      $.updateProjection(proj);

      return proj;
   }


computeCheckList ::=
   function (bindings, exceptAttrs=[]) {
      return Object.entries(bindings).filter(([attr, val]) => !exceptAttrs.includes(attr));
   }


suitsCheckList ::=
   function (rec, checkList) {
      return $.all(checkList, ([attr, val]) => rec[attr] === val);
   }


freeProjection ::=
   function (proj) {
      proj.rel.validRevDeps.delete(proj);
   }


validateProjection ::=
   function (proj) {
      proj.rel.validRevDeps.add(proj);
      proj.isValid = true;
   }


updateProjection ::=
   function (proj) {
      let {rel, kind} = proj;

      if (kind === 'full')
         ;
      else if (kind === 'entity') {
         let {entity, checkList} = proj;
         let rec = entity[rel.recSym];

         if (rel.records.has(rec)) {
            proj.rec = $.suitsCheckList(rec, checkList) ? rec : null;
         }
         else {
            proj.rec = null;
         }
      }
      else if (kind === 'unique-hit') {
         let {index, keys, checkList} = proj;
         let [rec] = $.indexRef(index, keys);

         if (rec !== undefined) {
            proj.rec = $.suitsCheckList(rec, checkList) ? rec : null;
         }
         else {
            proj.rec = null;
         }
      }
      else if (kind === 'partial') {
         $.assert(() => (proj.depVer === null) === (proj.myVer === null));

         if (proj.depVer !== null) {
            $.prepareVersion(proj.depVer);

            for (let rec of proj.depVer.removed) {
               if ($.suitsCheckList(rec, proj.checkList)) {
                  $.versionRemove(proj.myVer, rec);
               }
            }

            for (let rec of proj.depVer.added) {
               if ($.suitsCheckList(rec, proj.checkList)) {
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

      $.validateProjection(proj);
   }


addRecord ::=
   :This is an implementation function, not part of public interface
    It does the actual adding of `rec` to the relation.
   function (rel, rec) {
      rel.records.add(rec);

      if (rel.myVer !== null) {
         $.versionAdd(rel.myVer, rec);
      }

      for (let idx of rel.indices) {
         $.indexAdd(idx, rec);
      }
   }


addFact ::=
   function (rel, rec) {
      $.check(!rel.records.has(rec), `Duplicate record`);

      if (rel.protoEntity !== null) {
         let entity = rec[$.entity];

         if (entity[rel.recSym] != null) {
            // Need to remove the existing record first
            $.removeFact(rel, entity[rel.recSym]);
         }

         entity[rel.recSym] = rec;
      }

      $.addRecord(rel, rec);
      $.relationChanged(rel);
   }


addFacts ::=
   function (rel, recs) {
      for (let rec of recs) {
         $.addFact(rel, rec);
      }
   }


resetFacts ::=
   function (rel, recs) {
      $.emptyRelation(rel);
      $.addFacts(rel, recs);
   }


removeFact ::=
   function (rel, rec) {
      $.check(rel.records.has(rec), `Missing record`);
      $.doRemove(rel, rec);
      $.relationChanged(rel);
   }


doRemove ::=
   function (rel, rec) {
      rel.records.delete(rec);

      if (rel.myVer !== null) {
         $.versionRemove(rel.myVer, rec);
      }

      for (let idx of rel.indices) {
         $.indexRemove(idx, rec);
      }
   }


emptyRelation ::=
   function (rel) {
      rel.records.clear();

      for (let idx of rel.indices) {
         $.emptyIndex(idx);
      }

      $.relationChanged(rel);
   }


removeWhere ::=
   function (rel, bindings) {
      let toRemove = Array.from($.getRecords(rel.myInsts, bindings));

      for (let rec of toRemove) {
         $.doRemove(rel, rec);
      }

      $.relationChanged(rel);
   }


replaceWhere ::=
   function (rel, bindings, replacer) {
      let recs = Array.from($.getRecords(rel.myInsts, bindings));

      for (let rec of recs) {
         let newRec = replacer(rec);

         if (newRec === undefined) {
            continue;
         }

         $.removeFact(rel, rec);

         if (newRec !== null) {
            $.addFact(rel, newRec);
         }
      }
   }


revertTo ::=
   function (ver) {
      let rel = ver.owner;

      $.assert(() => rel.kind === 'base');

      $.prepareVersion(ver);

      for (let rec of ver.added) {
         $.doRemove(rel, rec);
      }

      for (let rec of ver.removed) {
         $.doAdd(rel, rec);
      }

      $.relationChanged(rel);
   }
