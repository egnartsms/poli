common
   arraysEqual
   assert
   all
   check
   filter
   isA
   map
dedb-index
   copyIndex
   indexKeys
dedb-relation
   rec2pair
   rec2pairFn
   rec2valFn
   pair2rec
   recordCollection
-----

refBaseInstance ::=
   function (rel, desired) {
      let inst = $.refExistingInstance(rel.myInsts, desired);

      $.assert(() => inst !== undefined);

      return inst;
   }

refDerivedInstance ::=
   function (proj, desired) {
      $.assert(() => proj.kind === 'derived');

      let inst = $.refExistingInstance(proj.myInsts, desired);

      if (inst !== undefined) {
         return inst;
      }

      inst = $.makeIndexInstance(proj, desired);
      inst.refCount += 1;
      proj.myInsts.push(inst);

      $.rebuildIndex(inst, proj.records);

      return inst;
   }

refExistingInstance ::=
   function (instances, desired) {
      let inst = instances.find(({index}) => $.arraysEqual(index, desired));

      if (inst !== undefined) {
         inst.refCount += 1;
      }

      return inst;
   }

releaseIndexInstance ::=
   function (inst) {
      $.assert(() => inst.refCount > 0);

      inst.refCount -= 1;

      if (inst.refCount === 0) {
         let insts = inst.owner.myInsts;
         let idx = insts.findIndex(inst);

         $.assert(() => idx !== -1);

         insts.splice(idx, 1);
      }
   }



indexRefWithBindings ::=
   function (inst, bindings) {
      return $.indexRef(inst, $.indexKeys(inst.index, bindings));
   }

indexRefSize ::=
   function (inst, keys) {
      // No special treatment of undefined keys
      let {index, map} = inst;
      let lvl = 0;

      for (let key of keys) {
         if (lvl === index.length) {
            break;
         }

         if (!map.has(key)) {
            return 0;
         }

         map = map.get(key);
         lvl += 1;
      }

      if (lvl === index.length) {
         return index.isUnique ? 1 : map.size;
      }
      else {
         return map.totalSize;
      }
   }

rebuildIndex ::=
   function (inst, records) {
      inst.map.clear();

      for (let rec of records) {
         $.indexAdd(inst, rec);
      }
   }


indexRemoveAll ::=
   function (inst, recs) {
      for (let rec of recs) {
         $.indexRemove(inst, rec);
      }
   }
