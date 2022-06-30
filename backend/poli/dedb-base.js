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
   invalidateProjection
   makeProjectionRegistry
dedb-relation
   rec2val
   rec2pair
dedb-query
   computeFilterBy
   suitsFilterBy
   getRecords
   findSuitableIdxInst
-----

baseRelation ::=
   function ({
      name,
      protoIdentity = null,
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
         symRec: null,  // if non-null, then 'entity[rel.symRec] === rec'
      };

      for (let spec of indexSpecs) {
         let index = $.indexFromSpec(spec);
         let inst = $.makeIndexInstance(rel, index);

         inst.refCount += 1;  // this guarantees that 'inst' will always be alive

         $.rebuildIndex(inst, rel.records);

         rel.myInsts.push(inst);
      }

      if (protoIdentity !== null) {
         $.check(rel.attrs.includes($.idty));

         let symRec = Symbol(name);

         $.populateProtoIdentity(rel, symRec, protoIdentity);
         rel.symRec = symRec;
      }

      return rel;
   }

invalidateRelation ::=
   function (rel) {
      for (let proj of rel.validRevDeps) {
         $.invalidateProjection(proj);
      }

      rel.validRevDeps.clear();
   }

makeProjection ::=
   function (rel, bindings) {
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

      let [inst, fitness] = $.findSuitableIdxInst(rel.myInsts, bindings);

      if (fitness === $.Fitness.uniqueHit) {
         proj.kind = 'unique-hit';
         proj.inst = inst;
         proj.keys = $.indexKeys(inst.index, bindings);
         proj.filterBy = $.computeFilterBy(bindings, inst.index);
         proj.rec = null;
      }
      else {
         let filterBy = $.computeFilterBy(bindings);
         
         if (filterBy.length === 0) {
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

freeProjection ::=
   function (proj) {
      proj.rel.validRevDeps.delete(proj);
   }

markAsValid ::=
   function (proj) {
      proj.rel.validRevDeps.add(proj);
      proj.isValid = true;
   }

updateProjection ::=
   function (proj) {
      let {rel, kind} = proj;

      if (kind === 'full')
         ;
      else if (kind === 'unique-hit') {
         let {inst, keys, filterBy} = proj;
         let [rec] = $.indexRef(inst, keys);

         if (rec !== null && !$.suitsFilterBy(rec, filterBy)) {
            rec = null;
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

addFact ::=
   function (rel, rec) {
      $.check(!rel.records.has(rec), `Duplicate record`);
      $.doAdd(rel, rec);
      $.invalidateRelation(rel);
   }

addFacts ::=
   function (rel, recs) {
      for (let rec of recs) {
         $.addFact(rel, rec);
      }
   }

resetFacts ::=
   function (rel, recs) {
      $.empty(rel);
      $.addFacts(rel, recs);
   }

doAdd ::=
   function (rel, rec) {
      rel.records.add(rec);

      if (rel.myVer !== null) {
         $.versionAdd(rel.myVer, rec);
      }

      for (let inst of rel.myInsts) {
         $.indexAdd(inst, rec);
      }
   }

removeFact ::=
   function (rel, rec) {
      $.check(rel.records.has(rec), `Missing record`);
      $.doRemove(rel, rec);
      $.invalidateRelation(rel);
   }

doRemove ::=
   function (rel, rec) {
      rel.records.delete(rec);

      if (rel.myVer !== null) {
         $.versionRemove(rel.myVer, rec);
      }

      for (let inst of rel.myInsts) {
         $.indexRemove(inst, rec);
      }
   }

empty ::=
   function (rel) {
      for (let rec of rel.records) {
         $.doRemove(rel, rec);
      }

      $.invalidateRelation(rel);
   }

removeWhere ::=
   function (rel, bindings) {
      let toRemove = Array.from($.getRecords(rel.myInsts, bindings));

      for (let rec of toRemove) {
         $.doRemove(rel, rec);
      }

      $.invalidateRelation(rel);
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

idty ::= 'idty'
symAssocRels ::= Symbol.for('poli.assoc-rels')

populateProtoIdentity ::=
   function (rel, symRec, protoIdentity) {
      for (let attr of rel.attrs) {
         $.check(!$.hasOwnProperty(protoIdentity, attr), () =>
            `Relation '${rel.name}': property '${attr}' already defined on the prototype`
         );

         Object.defineProperty(protoIdentity, attr, {
            configurable: true,
            enumerable: true,
            get() {
               return this[symRec][attr];
            }
         });
      }

      protoIdentity[$.symAssocRels].add(rel);
   }

makeIdentity ::=
   function (protoIdentity) {
      let identity = Object.create(protoIdentity);

      for (let rel of protoIdentity[$.symAssocRels]) {
         identity[rel.symRec] = null;
      }

      return identity;
   }

removeIdentity ::=
   function (rel, identity) {
      $.removeFact(rel, identity[rel.symRec]);
      identity[rel.symRec] = null;
   }

addIdentity ::=
   function (rel, newRec) {
      let identity = newRec[$.idty];
      let oldRec = identity[rel.symRec];

      if (oldRec !== null) {
         $.doRemove(rel, oldRec);
      }

      $.doAdd(rel, newRec);
      identity[rel.symRec] = newRec;

      $.invalidateRelation(rel);
   }

patchIdentity ::=
   function (rel, identity, fn, ...args) {
      let newRec = fn(identity[rel.symRec], ...args);
      $.check(newRec[$.idty] === identity, `patchIdentity: changed identity`);
      $.addIdentity(rel, newRec);
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

      $.invalidateRelation(rel);
   }
