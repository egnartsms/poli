common
   hasOwnProperty
   dumpImportSection
   moduleNames
   indexOf
delta
   modulesDelta
exc
   ApiError
   genericError
img2fs
   dumpModule
import
   importFor
loader
   * as: loader
module
   entrySource
op-edit
   addEntry
   editEntry
op-import
   * as: opImport
op-module
   * as: opModule
op-move
   * as: opMove
op-query
   * as: query
op-refactor
   * as: opRefactor
relation
   * as: rel
trie
   * as: trie
vector
   * as: vec
-----
delmark ::= Object.create(null)
main ::= function (sendMessage) {
   let pendingRmodules = null;

   function handleMessage(msg) {
      if (pendingRmodules !== null) {
         if (msg['type'] !== 'modify-code-result') {
            throw new Error(`Expected 'modify-code-result' message, got: ${msg['type']}`);
         }
         if (msg['success']) {
            $.loader.Rmodules = pendingRmodules;
            
            for (let module of $.loader.Rmodules) {
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

         pendingRmodules = null;

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
         let Rmodules = $.rel.copy($.loader.Rmodules);
         let result = $.operationHandlers[msg['op']](Rmodules, msg['args']);
         let actions = $.modulesDelta($.loader.Rmodules, Rmodules);

         if (actions.length > 0) {
            console.log("Code modifications:", actions);
            pendingRmodules = Rmodules;
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
   let module = $.trie.find(Rmodules.byName, name);

   if (module === undefined) {
      throw $.genericError(`Unknown module name: '${name}'`);
   }

   return module;
}
entryByName ::= function (module, name) {
   let entry = $.trie.find(module.entries.byName, name);

   if (entry === undefined) {
      throw $.genericError(`Module '${module.name}': not found entry '${name}'`);
   }

   return entry;
}
moduleEval ::= function moduleEval(ns, code) {
   let fun = Function('$', `"use strict";\n   return (${code})`);
   return fun.call(null, ns);
}
operationHandlers ::= ({
   getNameAt: function (Rmodules, {module: moduleName, at}) {
      let module = $.moduleByName(Rmodules, moduleName);
      return $.vec.at(module.members, at);
   },
   
   getDefinition: function (Rmodules, {module: moduleName, name}) {
      let module = $.moduleByName(Rmodules, moduleName);
      let entry = $.entryByName(module, name);

      return entry.strDef;
   },

   editEntry: function (Rmodules, {module: moduleName, name, newDef}) {
      let module = $.moduleByName(Rmodules, moduleName);
      let entry = $.entryByName(module, name);
      
      newDef = newDef.trim();
      let newVal = $.moduleEval(module.ns, newDef);

      $.rel.patchFact(Rmodules, module, {
         nsDelta: {
            [name]: newVal
         },
         entries: $.rel.update(module.entries, $.rel.patchFact, entry, {
            strDef: newDef,
            def: newDef
         })
      });
   },
   
   renameEntry: function (Rmodules, {module: moduleName, index, newName}) {
      let module = $.moduleByName(Rmodules, moduleName);
      let oldName = $.vec.at(module.members, index);

      if (oldName === undefined) {
         throw $.genericError(
            `Internal error: module '${module.name}': index out of bounds: '${index}'`
         );
      }

      let entry = $.entryByName(module, oldName);
      
      if ($.trie.find(module.entries.byName, newName) !== undefined) {
         throw $.genericError(`Module '${module.name}': entry '${newName}' already exists`);
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
      $.rel.changeFact(Rmodules, module, xmodule);
   },

   addEntry: function (Rmodules, {module: moduleName, name, def, index}) {
      let module = $.moduleByName(Rmodules, moduleName);

      if ($.trie.has(module.entries.byName, name)) {
         throw $.genericError(
            `'${name}' already defined or imported in the module '${module.name}'`
         );
      }

      def = def.trim();
      let val = $.moduleEval(module.ns, def);

      $.rel.patchFact(Rmodules, module, {
         nsDelta: {
            [name]: val
         },
         entries: $.rel.update(module.entries, $.addFact, {
            name: name,
            strDef: def,
            def: def            
         }),
         members: $.vec.update(module.memers, $.insertAt, index, name)
      });
   },
   
   moveBy1: function (Rmodules, {module: moduleName, name, direction}) {
      let module = $.moduleByName(Rmodules, moduleName);
      let entry = $.entryByName(module, name);
      
      if (direction !== 'up' && direction !== 'down') {
         throw $.genericError(`Invalid direction name: '${direction}'`);
      }

      let i = $.indexOf(module.members, entry.name);
      let j = direction === 'up' ?
               (i === 0 ? $.vec.size(module.members) - 1 : i - 1) :
               (i === $.vec.size(module.members) - 1 ? 0 : i + 1);

      $.rel.patchFact(Rmodules, module, {
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
