common
   check
   concat
   dumpImportSection
   hasOwnProperty
   findIndex
dedb-base
   revertTo
dedb-version
   refRelationState
   releaseVersion
   prepareVersion
vector
   * as: vec
trie
   * as: trie
world
   module
   entry
   import
   starImport
-----
makeSnapshot ::=
   function () {
      return {
         module: $.refRelationState($.module),
         entry: $.refRelationState($.entry),
         import: $.refRelationState($.import),
         starImport: $.refRelationState($.starImport),
         // This part is fulfilled on snapshot preparation
         m2old: null,
         mAffected: null,
         eAffected: null
      }
   }

releaseSnapshot ::=
   function (snapshot) {
      $.releaseVersion(snapshot.module);
      $.releaseVersion(snapshot.entry);
      $.releaseVersion(snapshot.import);
      $.releaseVersion(snapshot.starImport);
   }

prepareSnapshot ::=
   function (snapshot) {
      $.prepareVersion(snapshot.module);
      $.prepareVersion(snapshot.entry);
      $.prepareVersion(snapshot.import);
      $.prepareVersion(snapshot.starImport);

      // For the purposes of module modification, we look whether the module changed or
      // any of its entries changed.
      let m2old = new Map;

      for (let rec of snapshot.module.removed) {
         m2old.set(rec.idty, rec);
      }

      let mAffected = new Set(m2old.keys());
      let eAffected = new Set;

      for (let rec of $.concat(snapshot.entry.added, snapshot.entry.removed)) {
         eAffected.add(rec.idty);
         mAffected.add(rec.module);
      }

      snapshot.m2old = m2old;
      snapshot.mAffected = mAffected;
      snapshot.eAffected = eAffected;
   }

rollbackToSnapshot ::=
   function (snapshot) {
      $.releaseSnapshot(snapshot);

      $.revertTo(snapshot.module);
      $.revertTo(snapshot.entry);
      $.revertTo(snapshot.import);
      $.revertTo(snapshot.starImport);

      for (let module of snapshot.mAffected) {
         module[$.module.symRec].nsDelta = Object.create(null);
      }
   }

delmark ::= Object.create(null)

commitSnapshot ::=
   function (snapshot) {
      $.releaseSnapshot(snapshot);

      for (let module of snapshot.mAffected) {
         let {ns, nsDelta} = module;

         for (let [key, val] of Object.entries(nsDelta)) {
            if (val === $.delmark) {
               delete ns[key];
            }
            else {
               ns[key] = val;
            }
         }

         module[$.module.symRec].nsDelta = Object.create(null);
      }
   }

computeModificationsSince ::=
   function (snapshot) {
      // TODO: handle module add/remove/rename
      // TODO: implement 'replace-import-section':
      // {
      //    type: 'replace-import-section',
      //    with: $.dumpImportSection(module)
      // }
      $.prepareSnapshot(snapshot);

      let result = [];

      for (let module of snapshot.mAffected) {
         let mOld;

         if (snapshot.m2old.has(module)) {
            mOld = snapshot.m2old.get(module);
         }
         else {
            mOld = module[$.module.symRec];
         }

         result.push([
            module.name,
            Array.from(
               $.computeModuleModificationsSince(
                  mOld,
                  module[$.module.symRec],
                  e => snapshot.eAffected.has(e)
               )
            )
         ])
      }

      return result;
   }

computeModuleModificationsSince ::=
   function* (mOld, mNew, isEntryChanged) {
      function insert(entry, i) {
         return {
            type: 'insert',
            at: i,
            header: entry.isBox ? ('box ' + entry.name) : entry.name,
            body: entry.def,
         }
      }

      let mems = $.vec.copy(mOld.members);
      let i = 0;

      while (i < $.vec.size(mems) && i < $.vec.size(mNew.members)) {
         let etgt = $.vec.at(mNew.members, i);
         let j = $.vec.indexOf(mems, etgt, i);
         
         if (j === -1) {
            // etgt is not present in mems => create a new entry
            yield insert(etgt, i);
            $.vec.insertAt(mems, i, etgt);
            i += 1;
         }
         else {
            // etgt is at 'j' but it must be at 'i' instead. See what to do with what we
            // have at 'i'?
            let ix;  // where in 'mNew.members' is what we have at index 'i' in 'mems'.

            while (i < j) {
               // Delete at 'i' if it's not present in 'nMems' (we don't need it anyways).
               // Repeat that for the next entry at 'i', if needed.
               ix = $.vec.indexOf(mNew.members, $.vec.at(mems, i), i + 1);

               if (ix !== -1) {
                  break;
               }

               yield {
                  type: 'delete',
                  at: i
               };
               $.vec.deleteAt(mems, i);
               j -= 1;
            }

            if (i === j) {
               // etgt is exactly where it must be, so check whether it has changed
               if (isEntryChanged(etgt)) {
                  yield {
                     type: 'insert/replace',
                     onto: i,
                     name: etgt.isBox ? ('box ' + etgt.name) : etgt.name,
                     def: etgt.def,
                  }
                  // yield {
                  //    type: 'delete',
                  //    at: i
                  // };

                  // yield insert(etgt, i);
               }

               i += 1;
            }
            else {
               // We need to rotate [i, j] but left or right rotation? We normally want
               // right rotation unless j === i + 1 in which case we use left rotation
               // [i, ix]. This is a heuristic aimed to handle the case where the
               // bottommost entry is moved to the top. We just try to guess where to put
               // the 'i'th entry and use
               // 'ix' as a guess, although 'ix' is an index in another array.
               if (i + 1 === j) {
                  // left rotation
                  ix = Math.min(ix, $.vec.size(mems));
                  yield {
                     type: 'move',
                     from: i,
                     to: ix
                  };
                  $.vec.move(mems, i, ix);
               }
               else {
                  // right rotation
                  yield {
                     type: 'move',
                     from: j,
                     to: i
                  };
                  $.vec.move(mems, j, i);
               }
            }
         }
      }
      
      while (i < $.vec.size(mems)) {
         yield {
            type: 'delete',
            at: i
         };
         $.vec.deleteAt(mems, i);
      }

      while (i < $.vec.size(mNew.members)) {
         let entry = $.vec.at(mNew.members, i);

         yield insert(entry, i);   
         $.vec.insertAt(mems, i, entry);

         i += 1;
      }
   }
