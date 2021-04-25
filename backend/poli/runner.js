common
   hasOwnProperty
   dumpImportSection
   moduleNames
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
main ::= function (sendMessage) {
   let pendingRmodules = null;

   function handleMessage(msg) {
      if (pendingRmodules !== null) {
         if (msg['type'] !== 'modify-code-result') {
            throw new Error(`Expected 'modify-code-result' message, got: ${msg}`);
         }
         if (msg['result']) {
            $.loader.Rmodules = pendingRmodules;
            $.rel.freeze($.loader.Rmodules);
            
            for (let module of $.loader.Rmodules) {
               let changedKeys = Object.keys(module.nsDelta);
               if (changedKeys.length > 0) {
                  for (let key of changedKeys) {
                     module.ns[key] = module.nsDelta[key];
                     delete module.nsDelta[key];
                  }
               }
            }
         }
         else {
            console.warning(`Sublime could not modify code, rolling back`);
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
         let Rmodules = $.rel.newIdentity($.loader.Rmodules);
         let result = $.operationHandlers[msg['op']](Rmodules, msg['args']);
         let actions = $.modulesDelta($.loader.Rmodules, Rmodules);

         if (actions.length > 0) {
            console.log("Code modification:", actions);
            pendingRmodules = Rmodules;
         }

         sendMessage({
            type: 'api-call-result',
            success: true,
            result: result,
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
      throw $.genericError(`Member '${name}' not found in module '${module.name}'`);
   }

   return entry;
}
moduleEval ::= function moduleEval(ns, code) {
   let fun = Function('$', `"use strict";\n   return (${code})`);
   return fun.call(null, ns);
}
operationHandlers ::= ({
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

      module.nsDelta[name] = newVal;

      $.rel.changeFact(Rmodules, module, {
         ...module,
         entries: $.rel.updated(module.entries, (entries) => {
            $.rel.changeFact(entries, entry, {
               ...entry,
               strDef: newDef,
               def: newDef
            });
         })
      });

      return {
         normalizedSource: newDef
      }
   }
})
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
