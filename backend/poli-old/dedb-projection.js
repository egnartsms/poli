common
   assert
   check
   hasOwnProperty
   trackingFinal
   filter
   greatestBy
   isA
dedb-base
   * as: base
   entity
dedb-derived
   * as: derived
dedb-aggregate
   * as: agg
dedb-query
   suitsCheckList
   computeCheckList
dedb-index
   tupleFitnessByBindings
dedb-index-instance
   indexRefWithBindings
dedb-pyramid
   * as: py
-----

Bproj <-- version
Dproj <-- version, index


obtainProjectionVersion ::=
   :Get the current version of the projection of 'rel' identified by 'bindings'.

    Create projection if it does not exist yet.

    For derived relation, we returned a "positive" version -- the one that only remembers what has
    been added. Versions that track removed records should be requested separately
    ("negative version").

   function (rel, bindings) {
      let proj = $.projectionFor(rel, bindings);

      $.reifyCurrentVersion(proj);

      return proj.ver;
   }


projectionFor ::=
   function (rel, bindings) {
      return $.py.setDefault(rel.projections, bindings, () => $.makeProjection(rel, bindings));
   }


makeProjection ::=
   function (rel, bindings) {
      if (rel.kind === 'base') {
         return $.base.makeProjection(rel, bindings);
      }
      else if (rel.kind === 'derived') {
         throw new Error(`Not impl`);
         return $.derived.makeProjection(rel, bindings);
      }
      else if (rel.kind === 'aggregate') {
         throw new Error(`Not impl`);
         return $.agg.makeProjection(rel, bindings);
      }
      else {
         throw new Error(`Cannot make projection of a relation of type '${rel.type}'`);
      }
   }


reifyCurrentVersion ::=
   :Get the version of 'proj' at the current moment of time.

   function (proj) {
      if (proj.rel.kind === 'base') {
         $.base.reifyCurrentVersion(proj);
      }
      else if (proj.rel.kind === 'derived') {
         $.derived.reifyCurrentVersion(proj);
      }
      else {
         throw new Error(`Not impl`);
      }
   }


freeProjection ::=
   function (proj) {
      // TODO: indices are actually not guaranteed to be freed before the projection itself
      // (because of circular structures)
      //
      // $.assert(() => proj.rel.kind !== 'derived' || // proj.indices.length === 0);

      $.py.remove(proj.rel.projections, proj.bindings);
   }


invalidateProjection ::=
   function (root) {
      if (!root.isValid) {
         return;
      }

      /*let stack = [root];

      while (stack.length > 0) {
         let proj = stack.pop();

         if (proj.isValid) {
            stack.push(...proj.validRevDeps);

            proj.validRevDeps.clear();
            proj.isValid = false;
         }
      }*/
   }


invalidateAll ::=
   function (projs) {
      let stack = Array.from(projs);

      while (stack.length > 0) {
         let proj = stack.pop();

         if (proj.isValid) {
            stack.push(...proj.validRevDeps);

            proj.validRevDeps.clear();
            proj.isValid = false;
         }
      }
   }


updateProjection ::=
   function (proj) {
      if (proj.isValid) {
         return;
      }

      let {rel} = proj;

      if (rel.kind === 'base') {
         $.base.updateProjection(proj);
      }
      else if (rel.kind === 'derived') {
         $.derived.updateProjection(proj);
      }
      else if (rel.kind === 'aggregate') {
         $.agg.updateProjection(proj);
      }
      else {
         throw new Error;
      }
   }


referentialSize ::=
   function (proj) {
      if (proj.kind === 'unique-hit' || proj.kind === 'aggregate-0-dim') {
         return 1;
      }

      if (proj.kind === 'derived') {
         return proj.records.size;
      }

      if (proj.kind === 'aggregate') {
         return proj.size;
      }

      if (proj.kind === 'partial' || proj.kind === 'full') {
         return proj.rel.records.size;
      }

      throw new Error;
   }


projectionRecords ::=
   function (proj) {
      throw new Error(`Not impl`);

      if (proj.kind === 'derived') {
         return proj.records;
      }

      if (proj.kind === 'aggregate') {
         let [group2agg] = proj.Agroup2agg;
         
         return group2agg.keys();
      }

      if (proj.kind === 'full') {
         return proj.rel.records;
      }

      if (proj.kind === 'unique-hit') {
         return proj.rec === undefined ? [] : [proj.rec];
      }

      if (proj.kind === 'partial') {
         return $.filter(proj.rel.records, rec => $.suitsCheckList(rec, proj.filterBy));
      }

      throw new Error;   
   }
