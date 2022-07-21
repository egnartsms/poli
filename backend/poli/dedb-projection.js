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
   symEntity
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

-----

projectionFor ::=
   function (rel, bindings) {
      let key = $.projectionKey(rel, bindings);

      if (rel.projections.has(key)) {
         return rel.projections.get(key);
      }

      let proj = $.makeProjection(rel, bindings);

      rel.projections.set(key, proj);
      proj.myKey = key;

      return proj;
   }


projectionKey ::=
   function (rel, bindings) {
      let pieces = [];

      function push(attr) {
         let obj = Object.hasOwn(bindings, attr) ? bindings[attr] : undefined;

         pieces.push($.encodeObject(obj));
      }

      if (rel.protoEntity !== null) {
         push($.symEntity);
      }

      for (let attr of rel.attrs) {
         push(attr);
      }

      return pieces.join('\0');
   }


object2code ::= new WeakMap
nextObjectCode ::= 1

encodeObject ::=
   function (obj) {
      switch (typeof obj) {
         case 'undefined':
            return '';

         case 'boolean':
            return `b:${obj ? 1 : 0}`;

         case 'string':
            return `s:${obj}`;

         case 'symbol':
            throw new Error(`Cannot use symbols as projection specializers`);

         case 'number':
            return `n:${obj}`;

         case 'object':
         case 'function':
            {
               if (obj === null) {
                  return 'o';
               }

               let code = $.object2code.get(obj);

               if (code === undefined) {
                  code = $.nextObjectCode;
                  $.nextObjectCode += 1;
                  $.object2code.set(obj, code);
               }

               return `o:${code}`;
            }

         default:
            throw new Error(
               `Cannot use object of type '${typeof obj}' as projection specializer`
            );
      }
   }


makeProjection ::=
   function (rel, bindings) {
      if (rel.kind === 'base') {
         return $.base.makeProjection(rel, bindings);
      }
      else if (rel.kind === 'derived') {
         return $.derived.makeProjection(rel, bindings);
      }
      else if (rel.kind === 'aggregate') {
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
         proj.rel.projections.delete(proj.myKey);
         $.freeProjection(proj);
      }
   }


freeProjection ::=
   function (proj) {
      let {rel} = proj;

      if (rel.kind === 'base') {
         $.base.freeProjection(proj);
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

      let stack = [root];

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
