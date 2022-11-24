common
   all
   any
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
   versionAdd
   versionRemove
   prepareVersion

dedb-index
   IndexPack
   emptyIndex
   rebuildIndex
   indexAdd
   indexRemove
   makeBaseIndex
   indexRef
   indexRefWithBindings

dedb-tuple
   tupleFromSpec
   unique
   tupleKeys
   isUniqueHitByBindings
   tupleFitnessByBindings
   Fitness

dedb-projection
   invalidateProjection
   makeProjectionRegistry

dedb-relation
   rec2val
   rec2pair

dedb-pyramid
   * as: py

dedb-lifetime
   ref

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
         indices: $.IndexPack.new(),
         projections: $.py.make(protoEntity ? [$.entitySym, ...attrs] : [...attrs]),
         records: new Set,
      };

      for (let spec of indexSpecs) {
         let tuple = $.tupleFromSpec(spec);
         let index = $.makeBaseIndex(rel, tuple);

         $.IndexPack.add(rel.indices, index);
      }

      if (protoEntity !== null) {
         $.populateProtoEntity(rel);
      }

      return rel;
   }


*** Projections ***

makeProjection ::=
   function (rel, bindings) {
      let proj = {
         kind: 'proj',
         rel,
         bindings,
         validRevDeps: new Set,
         ver: null,
      };

      proj.ver = $.makeVersionFor(proj);

      return proj;
   }


*** Versions ***

makeVersionFor ::=
   function (proj) {
      let ver = {
         kind: 'ver',
         proj,
         added: new Set,
         removed: new (proj.rel.protoEntity === null ? Set : Map),
         next: null,
      };

      $.link(ver, proj);

      return ver;
   }


reifyCurrentVersion ::=
   function (proj) {
      if ($.isVersionPristine(proj.ver)) {
         return;
      }

      let nver = $.makeVersionFor(proj);

      proj.ver.next = nver;
      proj.ver = nver;
   }


isVersionPristine ::=
   function (ver) {
      return ver.added.size === 0 && ver.removed.size === 0;
   }


versionAddFact ::=
   function (ver, rec) {
      if (ver.removed.has(rec)) {
         ver.removed.delete(rec);
      }
      else {
         ver.added.add(rec);
      }
   }


versionRemoveFact ::=
   function (ver, rec) {
      if (ver.added.has(rec)) {
         ver.added.delete(rec);
      }
      else {
         ver.removed.add(rec);
      }
   }


versionAddEntity ::=
   function (ver, entity) {
      ver.added.add(entity);
   }


versionRemoveEntity ::=
   function (ver, entity, asSeen) {
      if (ver.added.has(entity)) {
         ver.added.delete(entity);
      }
      else {
         ver.removed.set(entity, asSeen);
      }
   }


touchProjection ::=
   function (proj) {
      if (proj.validRevDeps.size > 0) {
         $.invalidateAll(proj.validRevDeps);
         proj.validRevDeps.clear();
      }
   }


*** Entities ***

batch ::=
   :Current open batch: records to add, to remove, and dirty entities.
   null


myRelation ::=
   :Entity prototype property that points back to the relation object.
   Symbol.for('poli.myRelation')


store ::=
   :Entity property that points to the object which actually stores all the attributes.
   Symbol.for('poli.store')


backpatch ::=
   :Entity property that points to the most recent backpatch object.
   Symbol.for('poli.backpatch')


nextBackpatch ::=
   :Backpatch property that points to the next backpatch.
   Symbol.for('poli.nextBackpatch')


entitySym ::=
   :Store property that points to the entity.

    - store[$.entitySym] === entity
    - backpatch[$.entitySym] === entity (because Object.getPrototypeOf(backpatch) === store)

    NOTE: it is required that this property is a string rather than a symbol. This has to do with
    pyramid algorithms.

   'poli.entity'


populateProtoEntity ::=
   function (rel) {
      let {protoEntity} = rel;

      for (let attr of rel.attrs) {
         $.check(!Object.hasOwn(protoEntity, attr), () =>
            `Relation '${rel.name}': property '${attr}' already defined on the entity prototype`
         );
      }

      for (let attr of rel.attrs) {
         Object.defineProperty(protoEntity, attr, {
            configurable: true,
            enumerable: true,
            get() {
               return this[$.store][attr];
            },
            set(newValue) {
               let {[$.store]: store, [$.backpatch]: back} = this;

               if (!Object.hasOwn(back, attr)) {
                  back[attr] = store[attr];
               }

               store[attr] = newValue;

               if (rel.records.has(this)) {
                  if ($.batch === null) {
                     $.modifyEntity(this);
                  }
                  else {
                     $.markEntityModified(this);
                  }
               }
            }
         })
      }

      protoEntity[$.myRelation] = rel;
   }


runBatch ::=
   function (callback) {
      $.check($.batch === null, `Nested batches not supported`);

      let batch = {
         addedFacts: new Map,
         removedFacts: new Map,
         dirtyEntities: new Map,
      };

      $.batch = batch;

      try {
         callback();
      }
      finally {
         $.batch = null;
      }

      for (let [rec, rel] of batch.addedFacts) {
         $.addFact(rel, rec);
      }

      for (let [rec, rel] of batch.removedFacts) {
         $.removeFact(rel, rec);
      }

      for (let [entity, status] of batch.dirtyEntities) {
         switch (status) {
            case 'added':
               $.addEntity(entity);
               break;

            case 'removed':
               $.removeEntity(entity);
               break;

            case 'modified':
               $.modifyEntity(entity);
               break;

            default:
               throw new Error(`Programming error`);
         }
      }
   }


***** Operations *****

getRecords ::=
   function (rel, bindings) {
      $.check(rel.kind === 'base');

      let idx = $.IndexPack.bestIndex(rel.indices, bindings);
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
      $.check(rel.protoEntity === null);

      if ($.batch !== null) {
         let {addedFacts, removedFacts} = $.batch;

         if (removedFacts.has(rec)) {
            removedFacts.delete(rec);
         }
         else {
            $.check(!rel.records.has(rec), `Duplicate record`);
            addedFacts.set(rec, rel);
         }
      }
      else {
         $.check(!rel.records.has(rec), `Duplicate record`);

         rel.records.add(rec);

         for (let idx of $.IndexPack.iter(rel.indices)) {
            $.indexAdd(idx, rec);
         }

         for (let proj of $.py.matching(rel.projections, rec)) {
            $.versionAddFact(proj.ver, rec);
            $.touchProjection(proj);
         }
      }
   }


addFacts ::=
   function (rel, facts) {
      for (let rec of facts) {
         $.addFact(rel, rec);
      }
   }


removeFact ::=
   function (rel, rec) {
      $.check(rel.protoEntity === null);

      if ($.batch !== null) {
         let {addedFacts, removedFacts} = $.batch;

         if (addedFacts.has(rec)) {
            addedFacts.delete(rec);
         }
         else {
            $.check(rel.records.has(rec), `Missing record`);
            removedFacts.set(rec, rel);
         }
      }
      else {
         $.check(rel.records.has(rec), `Missing record`);

         rel.records.delete(rec);

         for (let idx of $.IndexPack.iter(rel.indices)) {
            $.indexRemove(idx, rec);
         }

         for (let proj of $.py.matching(rel.projections, rec)) {
            $.versionRemoveFact(proj.ver, rec);
            $.touchProjection(proj);
         }
      }
   }


addEntity ::=
   function (entity) {
      let {[$.myRelation]: rel} = entity;

      if ($.batch !== null) {
         let {dirtyEntities} = $.batch;
         let status = dirtyEntities.get(entity);

         if (status === undefined) {
            if (!rel.records.has(entity)) {
               dirtyEntities.set(entity, 'added');
            }
         }
         else if (status === 'removed') {
            dirtyEntities.set(entity, 'modified');
         }
      }
      else if (!rel.records.has(entity)) {
         let {[$.store]: store} = entity;

         rel.records.add(entity);

         for (let idx of $.IndexPack.iter(rel.indices)) {
            $.indexAdd(idx, entity, store);
         }

         for (let proj of $.py.matching(rel.projections, store)) {
            $.versionAddEntity(proj.ver, entity);
            $.touchProjection(proj);
         }

         let isDirty = $.optimizeEntityBackpatch(entity);

         if (isDirty) {
            entity[$.backpatch] = entity[$.backpatch][$.nextBackpatch] = {
               __proto__: store,
               [$.nextBackpatch]: null
            }
         }
      }
   }


removeEntity ::=
   :Remove `entity` from its relation.

    We think of removing an entity as of removing the entity's top backpatch (most recent snapshot).

   function (entity) {
      let {[$.myRelation]: rel} = entity;

      if ($.batch !== null) {
         let {dirtyEntities} = $.batch;
         let status = dirtyEntities.get(entity);

         if (status === undefined) {
            if (rel.records.has(entity)) {
               dirtyEntities.set(status, 'removed');
            }
         }
         else if (status === 'added') {
            dirtyEntities.delete(entity);
         }
         else if (status === 'modified') {
            dirtyEntities.set(status, 'removed');
         }
      }
      else if (rel.records.has(entity)) {
         rel.records.delete(entity);

         let {[$.backpatch]: back} = entity;

         for (let idx of $.IndexPack.iter(rel.indices)) {
            $.indexRemove(idx, entity, back);
         }

         for (let proj of $.py.matching(rel.projections, back)) {
            $.versionRemoveEntity(proj.ver, entity, back);
            $.touchProjection(proj);
         }
      }
   }


markEntityModified ::=
   :Holds:
     - $.batch !== null
     - rel.records.has(entity)

   function (entity) {
      let {[$.myRelation]: rel} = entity;
      let {dirtyEntities} = $.batch;

      if (!dirtyEntities.has(entity)) {
         dirtyEntities.set(entity, 'modified');
      }
   }


modifyEntity ::=
   :Holds:
     - $.batch === null
     - rel.records.has(entity)

   function (entity) {
      let isDirty = $.optimizeEntityBackpatch(entity);

      if (!isDirty) {
         return;
      }

      let {[$.myRelation]: rel, [$.store]: store, [$.backpatch]: back} = entity;

      for (let idx of $.IndexPack.iter(rel.indices)) {
         if ($.any(idx.tuple, a => Object.hasOwn(back, a))) {
            $.indexRemove(idx, entity, back);
            $.indexAdd(idx, entity, store);
         }
      }

      for (let proj of $.py.matching(rel.projections, back)) {
         $.versionRemoveEntity(proj.ver, entity, back);
         $.touchProjection(proj);
      }

      for (let proj of $.py.matching(rel.projections, store)) {
         $.versionAddEntity(proj.ver, entity);
         $.touchProjection(proj);
      }

      entity[$.backpatch] = back[$.nextBackpatch] = {
         __proto__: store,
         [$.nextBackpatch]: null
      };
   }


optimizeEntityBackpatch ::=
   function (entity) {
      let {[$.store]: store, [$.backpatch]: back} = entity;

      let isDirty = false;

      for (let attr of Object.keys(back)) {
         if (back[attr] === store[attr]) {
            delete back[attr];
         }
         else {
            isDirty = true;
         }
      }

      return isDirty;
   }


makeEntity ::=
   function (rel, data) {
      let store = {
         [$.entitySym]: null  // will be set to the entity itself
      };

      for (let attr of rel.attrs) {
         store[attr] = Object.hasOwn(data, attr) ? data[attr] : undefined;
      }

      let entity = {
         __proto__: rel.protoEntity,
         [$.store]: store,
         [$.backpatch]: {
            __proto__: store,
            [$.nextBackpatch]: null
         }
      };

      store[$.entitySym] = entity;

      return entity;
   }


resetRelation ::=
   :Remove all existing records and forget all the projections.
   function (rel) {
      $.py.empty(rel.projections);

      rel.records.clear();

      for (let idx of $.IndexPack.iter(rel.indices)) {
         $.emptyIndex(idx);
      }
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
