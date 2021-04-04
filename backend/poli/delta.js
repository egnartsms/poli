bootstrap
   assert
   hasOwnProperty
   modules
common
   dumpImportSection
module
   entrySource
transact
   arrayCopies
   mapBwdDeltas
   objBwdDeltas
-----
computeModuleDelta ::= function (module) {
   let entries = $.arrayCopies.get(module.entries);
   if (entries === undefined) {
      return [];
   }
   
   entries = [...entries];
   let actions = [];
   
   // check if the import section was touched
   // TODO: refactor into separate module
   let importSectionAffected = false;

   if ($.mapBwdDeltas.has(module.imported)) {
      importSectionAffected = true;
   }
   else {
      for (let [as, entry] of module.imported) {
         // TODO: combine "if there's delta" and "if delta has this prop" together
         let delta = $.objBwdDeltas.get(entry);
         if (delta !== undefined && $.hasOwnProperty(delta, 'name')) {
            importSectionAffected = true;
         }
      }
   }
   
   if (importSectionAffected) {
      actions.push({
         type: 'refresh-import-section',
         contents: $.dumpImportSection(module)
      });
   }
   
   function modifications(entry) {
      let res = {};
      let delta = $.objBwdDeltas.get(entry);
      
      if (delta !== undefined) {
         if ($.hasOwnProperty(delta, 'name')) {
            res.name = entry.name;
         }
         
         if ($.hasOwnProperty(delta, 'def')) {
            res.def = $.entrySource(entry.def);
         }
      }
      
      return res;
   }
   
   function rotateRight(i, j) {
      $.assert(i < j);
      
      let e = entries[j];
      entries.splice(j, 1);
      entries.splice(i, 0, e);
      
      actions.push({
         type: 'move',
         from: j,
         to: i,
         ...modifications(e)
      });
   }
   
   function replaceWith(i, j) {
      $.assert(i < j);
      
      if (i + 1 === j) {
         entries.splice(i, 1);
         actions.push({
            type: 'delete',
            index: i
         });
      }
      else {
         let e = entries[j];
         entries.splice(j, 1);
         entries.splice(i, 1, e);
         actions.push({
            type: 'move/replace',
            from: j,
            onto: i,
            ...modifications(e)
         });
      }
   }
   
   function rotateLeft(i, j) {
      $.assert(i < j);
      
      let e = entries[i];
      entries.splice(j + 1, 0, e);
      entries.splice(i, 1);
      actions.push({
         type: 'move',
         from: i,
         to: j + 1,
         ...modifications(e)
      });
   }
   
   let i = 0;
   
   while (i < module.entries.length) {
      let k = entries.indexOf(module.entries[i], i);
      
      if (k === -1) {
         // missing => create
         actions.push({
            type: 'insert',
            index: i,
            name: module.entries[i].name,
            def: $.entrySource(module.entries[i])
         });
         entries.splice(i, 0, module.entries[i]);
         i += 1;
         continue;
      }
      
      $.assert(k >= i);
      
      if (k === i) {
         let mod = modifications(entries[i]);
         if (Object.keys(mod).length > 0) {
            actions.push({
               type: 'edit',
               at: i,
               ...mod
            });
         }
         i += 1;
         continue;
      }
      
      let q = module.entries.indexOf(entries[i], i);
      if (q !== -1) {
         if (k === i + 1) {
            // do a left rotation of subarray [i, q]
            rotateLeft(i, Math.min(q, entries.length - 1));
         }
         else {
            rotateRight(i, k);
         }
         
         i += 1;
      }
      else {
         replaceWith(i, k);
      }
   }
   
   return actions;
}
computeDelta ::= function () {
   let result = [];
   
   for (let [name, module] of Object.entries($.modules)) {
      let actions = $.computeModuleDelta(module);
      
      if (actions.length > 0) {
         result.push([module.name, actions]);
      }
   }
   
   return result;
}
