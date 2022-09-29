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


releaseProjection ::=
   function (proj) {
      $.check(proj.refCount > 0);

      proj.refCount -= 1;

      if (proj.refCount === 0) {
         $.py.remove(proj.rel.projections, proj.bindings);

         $.freeProjection(proj);
      }
   }


freeProjection ::=
   function (proj) {
      let {rel} = proj;

      if (rel.kind === 'base') {
         // In base projection, there's nothing to free
      }
      else if (rel.kind === 'derived') {
         $.derived.freeProjection(proj);
      }
      else if (rel.kind === 'aggregate') {
         $.agg.freeProjection(proj);
      }
      else {
         throw new Error;
      }
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
