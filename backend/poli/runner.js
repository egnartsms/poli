common
   assert
   hasOwnProperty
   dumpImportSection
   indexOf
delta
   statesDelta
exc
   ApiError
   genericError
loader
   * as: loader
relation
   * as: rel
trie
   * as: trie
vector
   * as: vec
-----
delmark ::= Object.create(null)
main ::= function (sendMessage) {
   let pendingState = null;

   function commitPendingState(msg) {
      $.assert(pendingState !== null);

      if (msg['type'] !== 'modify-code-result') {
         throw new Error(`Expected 'modify-code-result' message, got: ${msg['type']}`);
      }

      if (msg['success']) {
         $.loader.Gstate = pendingState;
         
         for (let module of $.loader.Gstate.modules) {
            if (module.nsDelta !== null) {
               for (let [key, val] of Object.entries(module.nsDelta)) {
                  if (val === $.delmark) {
                     delete module.ns[key];
                  }
                  else {
                     module.ns[key] = val;
                  }
               }
               
               module.nsDelta = null;
            }
         }
      }

      pendingState = null;
   }

   function handleMessage(msg) {
      if (pendingState !== null) {
         commitPendingState(msg);
         return;
      }

      let stopwatch = (() => {
         let start = new Date;
         return () => {
            let elapsed = new Date - start;
            return `${elapsed} ms`;
         };
      })();

      try {      
         let newGstate = {...$.loader.Gstate};
         let result = $.operationHandlers[msg['op']](newGstate, msg['args']);
         let actions = $.statesDelta($.loader.Gstate, newGstate);

         if (actions.length > 0) {
            console.log("Code modifications:", actions);
            pendingState = newGstate;
         }

         sendMessage({
            type: 'api-call-result',
            success: true,
            result: result === undefined ? null : result,
            modifyCode: actions
         });

         console.log(msg['op'], `SUCCESS`, `(${stopwatch()})`);
      }
      catch (e) {
         let error, message, info;
         
         if (e instanceof $.ApiError) {
            error = e.error;
            message = e.message;
            info = e.info;
         }
         else {
            error = 'uncaught';
            message = e.message;
            info = {};
         }

         sendMessage({
            type: 'api-call-result',
            success: false,
            error: error,
            message: message,
            info: info,
         });

         console.error(e);
         console.log(msg['op'], `FAILURE`, `(${stopwatch()})`);
      }
   }

   return handleMessage;
}
moduleByName ::= function (Rmodules, name) {
   return $.trie.at(Rmodules.byName, name, () => {
      throw $.genericError(`Unknown module name: '${name}'`);
   });
}
entryByName ::= function (module, name) {
   return $.trie.at(module.entries.byName, name, () => {
      throw $.genericError(`Module '${module.name}': not found entry '${name}'`);
   });
}
moduleEval ::= function (ns, code) {
   let fun = Function('$', `"use strict";\n   return (${code})`);
   return fun.call(null, ns);
}
operationHandlers ::= ({
   getNameAt: function (G, {module: moduleName, at}) {
      let module = $.moduleByName(G.modules, moduleName);
      return $.vec.at(module.members, at);
   },
   
   getDefinition: function (G, {module: moduleName, name}) {
      let module = $.moduleByName(G.modules, moduleName);
      let entry = $.entryByName(module, name);

      return entry.strDef;
   },
   
   getCompletions: function (G, {module: moduleName, star, prefix}) {
      let module = $.moduleByName(G.modules, moduleName);
      
      let targetModule;

      if (star === null) {
         targetModule = module;
      }
      else {
         let simp = $.trie.tryChain(G.imports.into, module.id, star);
         if (simp === undefined || simp.name !== null) {
            return [];
         }

         targetModule = $.trie.at(G.modules.byId, simp.donorid);
      }

      let res = [];

      for (let name of $.moduleNames(targetModule, G.imports)) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      return res;
   },

   editEntry: function (G, {module: moduleName, name, newDef}) {
      let module = $.moduleByName(G.modules, moduleName);
      let entry = $.entryByName(module, name);
      
      newDef = newDef.trim();
      let newVal = $.moduleEval(module.ns, newDef);

      G.modules = $.rel.update(G.modules, $.rel.patchFact, module, {
         nsDelta: {
            [name]: newVal
         },
         entries: $.rel.update(module.entries, $.rel.patchFact, entry, {
            strDef: newDef,
            def: newDef
         })
      });
   },
   
   renameEntry: function (G, {module: moduleName, index, newName}) {
      let module = $.moduleByName(G.modules, moduleName);
      let oldName = $.vec.at(module.members, index);
      let entry = $.entryByName(module, oldName);
      
      if ($.isNameBound(module, newName, G.imports)) {
         throw $.genericError(
            `Module '${module.name}': name '${newName}' already defined or imported`
         );
      }
      
      let xmodule = {
         ...module,
         nsDelta: {
            [entry.name]: $.delmark,
            [newName]: module.ns[entry.name]
         },
         members: $.vec.update(module.members, $.vec.setAt, index, newName),
         entries: $.rel.update(module.entries, $.rel.patchFact, entry, {name: newName}),
      };
      
      $.renameRefs(xmodule, oldName, newName);
      
      // TODO: change references in other modules
      // TODO: change imports
      G.modules = $.rel.update(G.modules, $.rel.changeFact, module, xmodule);
   },

   addEntry: function (G, {module: moduleName, name, def, index}) {
      let module = $.moduleByName(G.modules, moduleName);

      if ($.isNameBound(module, name, G.imports)) {
         throw $.genericError(
            `Module '${module.name}': name '${name}' already defined or imported`
         );
      }

      def = def.trim();
      let val = $.moduleEval(module.ns, def);

      G.modules = $.rel.update(G.modules, $.rel.patchFact, module, {
         nsDelta: {
            [name]: val
         },
         entries: $.rel.update(module.entries, $.rel.addFact, {
            name: name,
            strDef: def,
            def: def
         }),
         members: $.vec.update(module.members, $.vec.insertAt, index, name)
      });
   },
   
   moveBy1: function (G, {module: moduleName, name, direction}) {
      let module = $.moduleByName(G.modules, moduleName);
      let entry = $.entryByName(module, name);
      
      if (direction !== 'up' && direction !== 'down') {
         throw $.genericError(`Invalid direction name: '${direction}'`);
      }

      let i = $.indexOf(module.members, entry.name);
      let j = direction === 'up' ?
               (i === 0 ? $.vec.size(module.members) - 1 : i - 1) :
               (i === $.vec.size(module.members) - 1 ? 0 : i + 1);

      G.modules = $.rel.update(G.modules, $.rel.patchFact, module, {
         members: $.vec.update(module.members, members => {
            $.vec.deleteAt(members, i);
            $.vec.insertAt(members, j, name);
         })
      });
   }
})
renameRefs ::= function (module, oldName, newName) {
   let re = new RegExp(`(?<=\\$\\.)(?:${oldName})\\b`, 'g');
   let xentries = $.rel.copy(module.entries);

   if (module.nsDelta === null) {
      module.nsDelta = {};
   }

   for (let entry of module.entries) {
      let newDef = entry.def.replace(re, match => newName);
      
      if (entry.def === newDef) {
         continue;
      }

      let newVal = $.moduleEval(module.ns, newDef);

      module.nsDelta[entry.name] = newVal;
      $.rel.patchFact(xentries, entry, {
         def: newDef,
         strDef: newDef
      });
   }

   module.entries = xentries;
}
moduleNames ::= function* (module, imports) {
   yield* module.members;
   yield* $.trie.keys($.trie.at(imports.into, module.id, $.trie.makeEmpty));
}
isNameBound ::= function (module, name, imports) {
   return (
      $.trie.hasAt(module.entries.byName, name) ||
      $.trie.hasChain(imports.into, module.id, name)
   );
}
isNameFree ::= function (module, name, imports) {
   return !$.isNameBound(module, name, imports);
}
serialize ::= function (obj) {
   const inds = '   ';

   function* serializeObject(object) {
      let entries = Object.entries(object);

      if (entries.length === 0) {
         yield '{}';
         return;
      }

      yield '({\n';
      for (let [key, val] of entries) {
         yield inds.repeat(1);
         yield key;
         yield ': ';
         yield* serialize(val, false);
         yield ',\n';
      }
      yield inds.repeat(0);
      yield '})';
   }

   function* serializeArray(array) {
      if (array.length === 0) {
         yield '[]';
         return;
      }

      yield '[\n';
      for (let obj of array) {
         yield inds.repeat(1);
         yield* serialize(obj, false);
         yield ',\n'
      }
      yield inds.repeat(0);
      yield ']';
   }

   function* serialize(obj, expand) {
      if (typeof obj === 'object') {
         if (obj === null) {
            yield String(obj);
         }
         else if (obj instanceof Array) {
            if (expand) {
               yield* serializeArray(obj);
            }
            else {
               yield '[...]';
            }
         }
         else {
            if (expand) {
               yield* serializeObject(obj);
            }
            else {
               yield '{...}';
            }
         }
      }
      else if (typeof obj === 'function') {
         if (expand) {
            yield obj.toString();
         }
         else {
            yield 'func {...}'
         }
      }
      else if (typeof obj === 'string') {
         yield JSON.stringify(obj);
      }
      else {
         yield String(obj);
      }
   }

   return Array.from(serialize(obj, true)).join('');
}
