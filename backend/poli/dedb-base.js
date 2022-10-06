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

dedb-pyramid
   * as: py
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
         indices: [],
         projections: $.py.make(attrs),
         records: new Set,
      };

      for (let spec of indexSpecs) {
         let tuple = $.tupleFromSpec(spec);
         let index = $.makeIndex(rel, tuple);

         index.refCount += 1;  // 'index' is going to be around forever

         rel.indices.push(index);
      }

      if (protoEntity !== null) {
         // $.populateProtoEntity(rel);
         throw new Error;
      }

      return rel;
   }


populateProtoEntity ::=
   function (rel) {
      let {protoEntity} = rel;

      for (let [abit, attr] of $.enumerate(rel.attrs)) {
         $.check(!Object.hasOwn(protoEntity, attr), () =>
            `Relation '${rel.name}': property '${attr}' already defined on the entity prototype`
         );

         let relevantIndices = rel.indices.filter(idx => idx.tuple.includes(attr));

         Object.defineProperty(protoEntity, attr, {
            configurable: true,
            enumerable: true,
            get() {
               return this[$.store][attr];
            },
            set(newValue) {
               let store = this[$.store];

               if (newValue === store[attr]) {
                  return;
               }

               for (let idx of relevantIndices) {
                  $.indexRemove(idx, this);
               }

               let backpatch = store[$.backpatch];

               if (backpatch === undefined) {
                  backpatch = store[$.backpatch] = {
                     __proto__: store
                  };
               }

               if (rel.myVer !== null && store[$.vnum] < rel.myVer.num) {
                  store[$.vnum]
               }

               if (!Object.hasOwn(backpatch, attr)) {
                  backpatch[attr] = store[attr];
               }

               store[attr] = newValue;

               for (let idx of relevantIndices) {
                  $.indexAdd(idx, this);
               }
            }
         })
      }
   }


refSubVersion ::=
   function (rel, bindings) {
      let proj = $.projectionFor(rel, bindings);

      $.ensureTopmostPristine(proj);
      $.versionAddRef(proj.ver);

      return proj.ver;
   }


releaseVersion ::=
   function (ver) {
      let {proj} = ver;

      $.assert(() => ver.refCount > 0 && ver.proj.refCount > 0);

      ver.refCount -= 1;
      proj.refCount -= 1;

      if (proj.refCount === 0) {
         $.py.remove(proj.rel.projections, proj.bindings);
      }
   }


projectionFor ::=
   function (rel, bindings) {
      return $.py.setDefault(rel.projections, bindings, () => $.makeProjection(rel, bindings));
   }


makeProjection ::=
   function (rel, bindings) {
      let proj = {
         rel,
         bindings,
         refCount: 0,
         ver: null,
         validRevDeps: new Set,
      };

      proj.ver = $.makeVersionFor(proj);

      return proj;
   }


makeVersionFor ::=
   function (proj) {
      return {
         proj,
         refCount: 0,
         added: new Set,
         removed: new Set,
         next: null,
      }
   }


isVersionPristine ::=
   function (ver) {
      return ver.added.size === 0 && ver.removed.size === 0;
   }


versionAddRef ::=
   function (ver) {
      ver.refCount += 1;
      ver.proj.refCount += 1;
   }


ensureTopmostPristine ::=
   function (proj) {
      if ($.isVersionPristine(proj.ver)) {
         return;
      }

      let nver = $.makeVersionFor(proj);

      proj.ver.next = nver;
      proj.ver = nver;
   }


projAdd ::=
   function (proj, rec) {
      $.invalidateProjectionRevdeps(proj);
      $.versionAdd(proj.ver, rec);
   }


projRemove ::=
   function (proj, rec) {
      $.invalidateProjectionRevdeps(proj);
      $.versionRemove(proj.ver, rec);
   }


invalidateProjectionRevdeps ::=
   function (proj) {
      if (proj.validRevDeps.size > 0) {
         $.invalidateAll(proj.validRevDeps);
         proj.validRevDeps.clear();
      }
   }


getRecords ::=
   function (rel, bindings) {
      $.check(rel.kind === 'base');

      let idx = $.findSuitableIndex(rel.indices, bindings);
      let recs;

      if (idx === undefined) {
         recs = rel.records;
      }
      else {
         recs = $.indexRefWithBindings(idx, bindings);
      }

      let filterBy = $.computeCheckList(bindings, idx !== undefined ? idx.tuple : []);

      return (filterBy.length === 0) ? recs :
         $.filter(recs, rec => $.suitsCheckList(rec, filterBy));
   }


computeCheckList ::=
   function (bindings, exceptAttrs=[]) {
      return Object.entries(bindings).filter(([attr, val]) => !exceptAttrs.includes(attr));
   }


suitsCheckList ::=
   function (rec, checkList) {
      return $.all(checkList, ([attr, val]) => rec[attr] === val);
   }


addFact ::=
   function (rel, rec) {
      $.check(!rel.records.has(rec), `Duplicate record`);

      rel.records.add(rec);

      for (let idx of rel.indices) {
         $.indexAdd(idx, rec);
      }

      for (let proj of $.py.matching(rel.projections, rec)) {
         $.projAdd(proj, rec);
      }
   }


addFacts ::=
   function (rel, recs) {
      for (let rec of recs) {
         $.addFact(rel, rec);
      }
   }


removeFact ::=
   function (rel, rec) {
      $.check(rel.records.has(rec), `Missing record`);

      rel.records.delete(rec);

      for (let idx of rel.indices) {
         $.indexRemove(idx, rec);
      }

      for (let proj of $.py.matching(rel.projections, rec)) {
         $.projRemove(proj, rec);
      }
   }


resetFacts ::=
   :Remove all existing records and add all the 'recs' to the relation 'rel'.

    NOTE: this is for very specific use cases. All the relation's projection are just forgotten.

   function (rel, recs) {
      $.py.empty(rel.projections);

      rel.records.clear();

      for (let idx of rel.indices) {
         $.emptyIndex(idx);
      }

      $.addFacts(rel, recs);
   }


removeWhere ::=
   function (rel, bindings) {
      let toRemove = Array.from($.getRecords(rel, bindings));

      for (let rec of toRemove) {
         $.removeFact(rel, rec);
      }
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
