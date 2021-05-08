common
   assert
   hasOwnProperty
   findIndex
vector
   * as: vec
relation
   * as: rel
trie
   * as: trie
-----
moduleDelta ::= function (module, xmodule) {
   if (module === xmodule) {
      return [];
   }

   let actions = [];

   // members is the working array that we perform all the operations on. The point is
   // to gradually transform it to be exactly 'xmodule.members'.
   let names = Array.from(module.members);
   let defs = Array.from(
      module.members,
      ename => $.trie.at(module.entries.byName, ename).strDef
   );
   
   function rotateRight(i, j) {
      $.assert(i < j);
      
      let [name, def] = [names[j], defs[j]];

      names.splice(j, 1);
      defs.splice(j, 1);
      names.splice(i, 0, name);
      defs.splice(i, 0, def);

      actions.push({
         type: 'move',
         from: j,
         to: i
      });
   }
   
   function replaceWith(i, j) {
      $.assert(i < j);
      
      let [name, def] = [names[j], entries[j]];

      names.splice(j, 1);
      defs.splice(j, 1);
      names.splice(i, 1, name);
      defs.splice(i, 1, def);

      actions.push({
         type: 'move/replace',
         from: j,
         onto: i
      });
   }
   
   function rotateLeft(i, j) {
      $.assert(i < j);
      
      let [name, def] = [names[i], defs[i]];

      names.splice(j + 1, 0, name);
      defs.splice(j + 1, 0, def);
      names.splice(i, 1);
      defs.splice(i, 1);

      actions.push({
         type: 'move',
         from: i,
         to: j + 1
      });
   }

   let def2index = (function () {
      let map = new Map;
      let i = 0;

      for (let name of xmodule.members) {
         map.set($.trie.at(xmodule.entries.byName, name).strDef, i);
         i += 1;
      }

      return map;
   })();

   let i = 0;

   while (i < $.vec.size(xmodule.members) && i < names.length) {
      let mustBeName = $.vec.at(xmodule.members, i);
      let mustBeDef = $.trie.at(xmodule.entries.byName, mustBeName).strDef;
      
      // 'j' is the index where we have what must be at the index 'i'
      let j = defs.indexOf(mustBeDef, i);
      
      // k is where *in the new array* what we have at index 'i' in the working array
      let k = def2index.get(defs[i]);
      
      if (j === -1) {
         // missing => create or replace
         if (k === undefined) {
            actions.push({
               type: 'insert/replace',
               onto: i,
               name: mustBeName,
               def: mustBeDef
            });
            
            names.splice(i, 1, mustBeName);
            defs.splice(i, 1, mustBeDef);
         }
         else {
            actions.push({
               type: 'insert',
               at: i,
               name: mustBeName,
               def: mustBeDef
            });
            
            names.splice(i, 0, mustBeName);
            defs.splice(i, 0, mustBeDef);
         }
      }
      else if (i < j) {
         // ok, need to rotate [i, j] but left or right rotation? We normally want
         // right rotation unless j === i + 1 in which case we use left rotation [i, k],
         // where k may be anything >=j. Heuristically, we try to take as k the index in
         // xmodule of what we now have at index i. This strategy handles the case where
         // the bottommost entry is moved to the top.
         if (k === undefined) {
            // What we have at i is not going to be reused
            replaceWith(i, j);
         }
         else if (j === i + 1) {
            // do a left rotation of subarray [i, i + k]
            rotateLeft(i, Math.min(k, names.length - 1));
         }
         else {
            rotateRight(i, j);
         }
      }

      if (names[i] !== mustBeName) {
         actions.push({
            type: 'rename',
            at: i,
            newName: mustBeName
         });
         names[i] = mustBeName;
      }

      i += 1;  
   }
   
   while (i < names.length) {
      actions.push({
         type: 'delete',
         at: i
      });
      names.splice(i, 1);
      defs.splice(i, 1);
   }

   while (i < $.vec.size(xmodule.members)) {
      let mustBeName = $.vec.at(xmodule.members, i);
      let mustBeDef = $.trie.at(xmodule.entries.byName, mustBeName).strDef;

      actions.push({
         type: 'insert',
         at: i,
         name: mustBeName,
         def: mustBeDef
      });
      
      names.splice(i, 0, mustBeName);
      defs.splice(i, 0, mustBeDef);

      i += 1;
   }

   return actions;
}
modulesDelta ::= function (modules, xmodules) {
   let delta = [];

   for (let module of $.rel.facts(modules)) {
      let xmodule = $.trie.at(xmodules.byName, module.name);
      let mdelta = $.moduleDelta(module, xmodule);
      if (mdelta.length > 0) {
         delta.push([module.name, mdelta]);
      }
      
   }
   
   return delta;
}
