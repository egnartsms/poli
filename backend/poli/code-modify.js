common
   check
   concat
   dumpImportSection
   hasOwnProperty
   findIndex
vector
   * as: vec
trie
   * as: trie
world
   groups
   delta
-----
contentModifyActions ::= function (module) {
   let actions = [];

   let mems = $.vec.copy(module.ov.members);
   let Nmems = module.v.members;

   let i = 0;

   while (i < $.vec.size(mems) && i < $.vec.size(Nmems)) {
      let etgt = $.vec.at(Nmems, i);
      let j = $.vec.indexOf(mems, etgt, i);
      
      if (j === -1) {
         // etgt is not present in mems => create a new entry
         actions.push({
            type: 'insert',
            at: i,
            name: etgt.v.name,
            def: etgt.v.strDef
         })
         $.vec.insertAt(mems, i, etgt);
         i += 1;
      }
      else {
         // etgt is at 'j' but it must be at 'i' instead. See what to do with what we
         // have at 'i'.
         let ix;  // where in 'Nmems' is what we have at index 'i' in 'mems'.

         while (i < j) {
            // Delete at 'i' if it's not present in 'Nmems' (we don't need it anyways).
            // Repeat that for the next entry at 'i', if needed.
            ix = $.vec.indexOf(Nmems, $.vec.at(mems, i), i + 1);
            if (ix !== -1) {
               break;
            }

            actions.push({
               type: 'delete',
               at: i
            });
            $.vec.deleteAt(mems, i);
            j -= 1;
         }

         if (i === j) {
            // etgt is exactly where it must be, so check whether it was changed
            actions.push({
               type: 'edit',
               at: i,
               name: etgt.v.name === etgt.ov.name ? null : etgt.v.name,
               def: etgt.v.strDef === etgt.ov.strDef ? null : etgt.v.strDef,
            });
            i += 1;
         }
         else {
            // We need to rotate [i, j] but left or right rotation? We normally want
            // right rotation unless j === i + 1 in which case we use left rotation [i, ix].
            // This is a heuristic aimed to handle the case where the bottommost entry is 
            // moved to the top. We just try to guess where to put the 'i'th entry and use
            // 'ix' as a guess, although 'ix' is an index in another array.
            if (j - i === 1) {
               // left rotation
               ix = Math.min(ix, $.vec.size(mems));
               actions.push({
                  type: 'move',
                  from: i,
                  to: ix
               });
               $.vec.move(mems, i, ix);
            }
            else {
               // right rotation
               actions.push({
                  type: 'move',
                  from: j,
                  to: i
               });
               $.vec.move(mems, j, i);
            }
         }
      }
   }
   
   while (i < $.vec.size(mems)) {
      actions.push({
         type: 'delete',
         at: i
      });
      $.vec.deleteAt(mems, i);
   }

   while (i < $.vec.size(Nmems)) {
      let mustBeName = $.vec.at(xmodule.members, i);
      let mustBeDef = $.trie.at(xmodule.entries.byName, mustBeName).strDef;

      let entry = $.vec.at(Nmems, i);

      actions.push({
         type: 'insert',
         at: i,
         name: entry.v.name,
         def: entry.v.strDef
      });
      
      $.vec.insertAt(mems, i, entry);

      i += 1;
   }

   return actions;
}
globalCodeModifications ::= function () {
   // TODO: handle module add/remove/rename
   let mContents = new Set;
   let mImports = new Set;

   for (let module of $.delta['module'].changed) {
      if (module.v.members !== module.ov.members) {
         mContents.add(module);
      }

      if (module.v.name !== module.ov.name) {
         for (let entry of $.trie.ivalues(module.entries.v)) {
            for (let recp of $.trie.ikeys(entry.imports.v)) {
               mImports.add(recp);
            }
         }
      }
   }

   for (let entry of $.delta['entry'].changed) {
      mContents.add(entry.ov.module);
      mContents.add(entry.v.module);

      if (entry.ov.name !== entry.v.name) {
         for (let recp of $.trie.ikeys(entry.imports.v)) {
            mImports.add(recp);
         }
      }
   }

   for (let imp of $.delta['import'].affected) {
      mImports.add(imp.recp);
   }

   let result = new Map;

   for (let module of mContents) {
      result.set(module, $.contentModifyActions(module));
   }

   for (let module of mImports) {
      let actions = result.get(module);

      if (actions === undefined) {
         actions = [];
         result.set(module, actions);
      }

      actions.push({
         type: 'replace-import-section',
         with: $.dumpImportSection(module)
      });
   }

   return Array.from(result, ([module, actions]) => [module.v.name, actions]);
}
