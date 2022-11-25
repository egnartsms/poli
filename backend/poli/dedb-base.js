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
         projections: $.py.make(protoEntity ? [$.myEntity, ...attrs] : [...attrs]),
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


isRelationEntityBased ::=
   function (rel) {
      return rel.protoEntity !== null;
   }


*** Projection and Version ***

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


makeVersionFor ::=
   function (proj) {
      let ver = {
         kind: 'ver',
         proj,
         added: new Set,
         removed: new ($.isRelationEntityBased(proj.rel) ? Map : Set),
         next: null,
      };

      $.ref(ver, proj);

      return ver;
   }


reifyCurrentVersion ::=
   function (proj) {
      if ($.isVersionPristine(proj.ver)) {
         return;
      }

      let nver = $.makeVersionFor(proj);

      proj.ver = proj.ver.next = nver;
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


versionRemoveEntitySnapshot ::=
   function (ver, snapshot) {
      let entity = snapshot[$.myEntity];

      if (ver.added.has(entity)) {
         ver.added.delete(entity);
      }
      else {
         ver.removed.set(entity, snapshot);
      }
   }


touchProjection ::=
   function (proj) {
      if (proj.validRevDeps.size > 0) {
         $.invalidateAll(proj.validRevDeps);
         proj.validRevDeps.clear();
      }
   }


*** Facts ***

addFacts ::=
   function (rel, recs) {
      for (let rec of recs) {
         $.addFact(rel, rec);
      }
   }


addFact ::=
   function (rel, rec) {
      $.check(!$.isRelationEntityBased(rel));

      if ($.batch !== null) {
         $.markFactForAdding(rel, rec);
      }
      else {
         $.check(!rel.records.has(rec), `Duplicate record`);

         $.doAddFact(rel, rec);
      }
   }


doAddFact ::=
   function (rel, rec) {
      rel.records.add(rec);

      for (let idx of $.IndexPack.iter(rel.indices)) {
         $.indexAdd(idx, rec);
      }

      for (let proj of $.py.matching(rel.projections, rec)) {
         $.versionAddFact(proj.ver, rec);
         $.touchProjection(proj);
      }
   }


removeFact ::=
   function (rel, rec) {
      $.check(!$.isRelationEntityBased(rel));

      if ($.batch !== null) {
         $.markFactForRemoval(rel, rec);
      }
      else {
         $.check(rel.records.has(rec), `Missing record`);

         $.doRemoveFact(rel, rec);
      }
   }


doRemoveFact ::=
   function (rel, rec) {
      rel.records.delete(rec);

      for (let idx of $.IndexPack.iter(rel.indices)) {
         $.indexRemove(idx, rec);
      }

      for (let proj of $.py.matching(rel.projections, rec)) {
         $.versionRemoveFact(proj.ver, rec);
         $.touchProjection(proj);
      }
   }


*** Entities ***

myRelation ::=
   :Entity prototype property that points back to the relation object.
   Symbol.for('poli.myRelation')


myStore ::=
   :Entity property that points to the object which actually stores all the attributes.
   Symbol.for('poli.myStore')


mostRecentSnapshot ::=
   :Entity property that points to its most recent snapshot.
   Symbol.for('poli.mostRecentSnapshot')


nextSnapshot ::=
   :Snapshot property that points to the next snapshot in a chain.
   Symbol.for('poli.nextSnapshot')


myEntity ::=
   :Store property that points to the entity.

    - store[$.myEntity] === entity
    - snapshot[$.myEntity] === entity (because Object.getPrototypeOf(snapshot) === store)

    NOTE: it is required that this property is a string rather than a symbol. This has to do with
    pyramid algorithms.

   'poli.myEntity'


isEntityActive ::=
   function (entity) {
      return entity[$.myRelation].records.has(entity);
   }


makeEntity ::=
   function (rel, data) {
      let store = {
         [$.myEntity]: null  // will be set to the entity itself
      };

      for (let attr of rel.attrs) {
         store[attr] = Object.hasOwn(data, attr) ? data[attr] : undefined;
      }

      let entity = {
         __proto__: rel.protoEntity,
         [$.myStore]: store,
         [$.mostRecentSnapshot]: {
            __proto__: store,
            [$.nextSnapshot]: null
         }
      };

      store[$.myEntity] = entity;

      return entity;
   }


populateProtoEntity ::=
   function (rel) {
      let {protoEntity} = rel;

      for (let attr of rel.attrs) {
         $.check(!Object.hasOwn(protoEntity, attr), () =>
            `Relation '${rel.name}': property '${attr}' already defined on the entity `
            `prototype`
         );
      }

      for (let attr of rel.attrs) {
         Object.defineProperty(protoEntity, attr, {
            configurable: true,
            enumerable: true,
            get() {
               return this[$.myStore][attr];
            },
            set(newValue) {
               let isActive = $.isEntityActive(this);

               $.check(!(isActive && $.batch !== null), `Cannot mutate entities outside a batch`);

               let {[$.myStore]: store, [$.mostRecentSnapshot]: snapshot} = this;

               if (!Object.hasOwn(snapshot, attr)) {
                  snapshot[attr] = store[attr];
               }

               store[attr] = newValue;

               if (isActive) {
                  $.markEntityForModification(this);
               }
            }
         })
      }

      protoEntity[$.myRelation] = rel;
   }


addEntity ::=
   :Remove 'entity' from its relation.

    Entity adding is an idempotent operation (in contrast to fact adding).

   function (entity) {
      if ($.batch !== null) {
         $.markEntityForAdding(entity);
      }
      else if (!$.isEntityActive(entity)) {
         $.doAddEntity(entity);
      }
   }


doAddEntity ::=
   function (entity) {
      $.reifyCurrentSnapshot(entity);

      let {[$.myRelation]: rel, [$.myStore]: store} = entity;

      rel.records.add(entity);

      for (let idx of $.IndexPack.iter(rel.indices)) {
         $.indexAdd(idx, entity, store);
      }

      for (let proj of $.py.matching(rel.projections, store)) {
         $.versionAddEntity(proj.ver, entity);
         $.touchProjection(proj);
      }
   }


removeEntity ::=
   :Remove `entity` from its relation.

    Entity removal is an idempotent operation (in contrast to fact removal).

   function (entity) {
      if ($.batch !== null) {
         $.markEntityForRemoval(entity);
      }
      else if ($.isEntityActive(entity)) {
         $.doRemoveEntity(entity);
      }
   }


doRemoveEntity ::=
   function (entity) {
      rel.records.delete(entity);

      let {[$.mostRecentSnapshot]: snapshot} = entity;

      for (let idx of $.IndexPack.iter(rel.indices)) {
         $.indexRemove(idx, entity, snapshot);
      }

      for (let proj of $.py.matching(rel.projections, snapshot)) {
         $.versionRemoveEntitySnapshot(proj.ver, snapshot);
         $.touchProjection(proj);
      }
   }


doModifyEntity ::=
   function (entity) {
      let {
         [$.myRelation]: rel,
         [$.myStore]: store,
         [$.mostRecentSnapshot]: snapshot
      } = entity;

      $.reifyCurrentSnapshot(entity);

      if (snapshot === entity[$.mostRecentSnapshot]) {
         return;
      }

      for (let idx of $.IndexPack.iter(rel.indices)) {
         if ($.any(idx.tuple, attr => Object.hasOwn(snapshot, attr))) {
            $.indexRemove(idx, entity, snapshot);
            $.indexAdd(idx, entity, store);
         }
      }

      for (let proj of $.py.matching(rel.projections, snapshot)) {
         $.versionRemoveEntitySnapshot(proj.ver, snapshot);
         $.touchProjection(proj);
      }

      for (let proj of $.py.matching(rel.projections, store)) {
         $.versionAddEntity(proj.ver, entity);
         $.touchProjection(proj);
      }
   }


reifyCurrentSnapshot ::=
   function (entity) {
      let {[$.myStore]: store, [$.mostRecentSnapshot]: snapshot} = entity;

      let isDirty = false;

      for (let attr of Object.keys(snapshot)) {
         if (snapshot[attr] === store[attr]) {
            delete snapshot[attr];
         }
         else {
            isDirty = true;
         }
      }

      if (isDirty) {
         let newSnapshot = {
            __proto__: store,
            [$.nextSnapshot]: null
         };

         snapshot[$.nextSnapshot] = newSnapshot;
         entity[$.mostRecentSnapshot] = newSnapshot;
      }
   }


*** Batch ***

batch ::=
   :Current open batch: records to add, to remove, and dirty entities.
   null


makeBatch ::=
   function () {
      return {
         addedFacts: new Map,
         removedFacts: new Map,
         dirtyEntities: new Map,
      }
   }


markFactForAdding ::=
   function (rel, rec) {
      let {addedFacts, removedFacts} = $.batch;

      if (removedFacts.has(rec)) {
         removedFacts.delete(rec);
      }
      else {
         $.check(!rel.records.has(rec), `Duplicate record`);

         addedFacts.set(rec, rel);
      }
   }


markFactForRemoval ::=
   function (rel, rec) {
      let {addedFacts, removedFacts} = $.batch;

      if (addedFacts.has(rec)) {
         addedFacts.delete(rec);
      }
      else {
         $.check(rel.records.has(rec), `Missing record`);

         removedFacts.set(rec, rel);
      }
   }


markEntityForAdding ::=
   function (entity) {
      let {dirtyEntities} = $.batch;
      let status = dirtyEntities.get(entity);

      if (status === undefined) {
         if (!$.isEntityActive(entity)) {
            dirtyEntities.set(entity, 'added');
         }
      }
      else if (status === 'removed') {
         dirtyEntities.set(entity, 'modified');
      }
   }


markEntityForRemoval ::=
   function (entity) {
      let {dirtyEntities} = $.batch;
      let status = dirtyEntities.get(entity);

      if (status === undefined) {
         if ($.isEntityActive(entity)) {
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


markEntityForModification ::=
   function (entity) {
      let {dirtyEntities} = $.batch;

      if (!dirtyEntities.has(entity)) {
         dirtyEntities.set(entity, 'modified');
      }
   }


runInBatch ::=
   function (callback) {
      $.check($.batch === null, `Nested batches not supported`);

      let batch = $.makeBatch();

      $.batch = batch;

      try {
         callback();
      }
      finally {
         // TODO: need to rollback dirtyEntities?
         $.batch = null;
      }

      for (let [rec, rel] of batch.addedFacts) {
         $.doAddFact(rel, rec);
      }

      for (let [rec, rel] of batch.removedFacts) {
         $.doRemoveFact(rel, rec);
      }

      for (let [entity, status] of batch.dirtyEntities) {
         switch (status) {
            case 'added':
               $.doAddEntity(entity);
               break;

            case 'removed':
               $.doRemoveEntity(entity);
               break;

            case 'modified':
               $.doModifyEntity(entity);
               break;

            default:
               throw new Error(`Programming error`);
         }
      }
   }


*** Relation-level operations ***

getRecords ::=
   :Return iterable of all records of 'rel' matching given 'bindings'.

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
