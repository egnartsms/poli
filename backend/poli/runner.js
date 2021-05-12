common
   assert
   concat
   dumpImportSection
   hasOwnProperty
   indexOf
   joindot
   map
   patchNullableObj
   patchObj
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
         let G = $.loader.Gstate;
         let {dG, G: xG, ret} = $.operationHandlers[msg['op']](G, msg['args']);
         
         if (xG === undefined) {
            xG = dG === undefined ? G : {...G, ...dG};
         }

         let actions = $.statesDelta(G, xG);

         if (actions.length > 0) {
            console.log("Code modifications:", actions);
            pendingState = xG;
         }

         sendMessage({
            type: 'api-call-result',
            success: true,
            result: ret === undefined ? null : ret,
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
   getModuleNames: function (G, {module: moduleName}) {
      let module = $.moduleByName(G.modules, moduleName);
      
      return {
         ret: Array.from($.moduleNames(module, G.imports))
      };
   },

   getNameAt: function (G, {module: moduleName, at}) {
      let module = $.moduleByName(G.modules, moduleName);

      return {
         ret: $.vec.at(module.members, at)
      };
   },
   
   getDefinition: function (G, {module: moduleName, name}) {
      let module = $.moduleByName(G.modules, moduleName);
      let entry = $.entryByName(module, name);

      return {
         ret: entry.strDef
      };
   },
   
   getCompletions: function (G, {module: moduleName, star, prefix}) {
      let module = $.moduleByName(G.modules, moduleName);
      
      let targetModule;

      if (star === null) {
         targetModule = module;
      }
      else {
         let simp = $.trie.tryAt(G.imports.into, module.id, star);
         if (simp === undefined || simp.name) {
            return {ret: []};
         }

         targetModule = $.trie.at(G.modules.byId, simp.donorid);
      }

      let res = [];

      for (let name of $.moduleNames(targetModule, G.imports)) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      return {
         ret: res
      }
   },
   
   getImportables: function (G, {recp: recpName}) {
      let recp = $.moduleByName(G.modules, recpName);

      return {
         ret: $.importablesInto(recp, G.modules, G.imports)
      };
   },

   editEntry: function (G, {module: moduleName, name, newDef}) {
      let module = $.moduleByName(G.modules, moduleName);
      let entry = $.entryByName(module, name);
      
      let mG = $.Gcopy(G);
      
      $.setEntryDef(mG, module.id, entry.name, newDef.trim());
      
      return {G: mG};
   },
   
   renameEntry: function (G, {module: moduleName, index, newName}) {
      let module = $.moduleByName(G.modules, moduleName);
      let oldName = $.vec.at(module.members, index);
      $.entryByName(module, oldName);
      
      if ($.isNameBound(module, newName, G.imports)) {
         throw $.genericError(
            `Module '${module.name}': name '${newName}' already defined or imported`
         );
      }
      
      let mG = $.Gcopy(G);
      
      let offendingModules = Array.from(
         $.offendingModulesOnRename(mG, module.id, oldName, newName)
      );

      if (offendingModules.length > 0) {
         throw $.genericError(
            `Cannot rename to "${newName}": cannot rename imports in ` +
            `modules: ${offendingModules.map(m => m.name).join(',')}`
         );
      }

      $.changeReferrersForRename(mG, module.id, oldName, newName);
      $.changeImportsForRename(mG, module.id, oldName, newName);
      $.rel.alterFactByPk(mG.modules, module.id, module => $.patchModule(module, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: module.ns[oldName]
         },
         members: $.vec.update(module.members, $.vec.setAt, index, newName),
         entries: $.rel.update(
            module.entries, $.rel.patchFactByPk, oldName, {name: newName}
         ),
      }));

      return {G: mG}
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

      return {
         dG: {
            modules: $.rel.update(G.modules, $.rel.alterFact, module, $.patchModule, {
               nsDelta: {
                  [name]: val
               },
               entries: $.rel.update(module.entries, $.rel.addFact, {
                  name: name,
                  strDef: def,
                  def: def
               }),
               members: $.vec.update(module.members, $.vec.insertAt, index, name)
            })
         }
      }
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

      return {
         dG: {
            modules: $.rel.update(G.modules, $.rel.patchFact, module, {
               members: $.vec.update(module.members, members => {
                  $.vec.deleteAt(members, i);
                  $.vec.insertAt(members, j, name);
               })
            })
         }
      }
   },
   
   import: function (G, {recp: recpName, donor: donorName, name, alias}) {
      let recp = $.moduleByName(G.modules, recpName);
      let donor = $.moduleByName(G.modules, donorName);

      if (name !== '') {
         if (!$.trie.hasAt(donor.entries.byName, name)) {
            throw $.genericError(
               `Module '${recp.name}': cannot import '${entry}' from ` +
               `'${donor.name}': no such definition`
            );
         }
      }
      else if (alias === null) {
         throw $.genericError(
            `Cannot star import '${donor.name}' into '${recp.name}' without alias`
         );
      }
      
      let imp = $.loader.import({
         recpid: recp.id,
         donorid: donor.id,
         entry: name,
         alias: alias
      });
      
      if ($.isNameBound(recp, imp.importedAs, G.imports)) {
         throw $.genericError(
            `Module '${recp.name}': cannot import '${$.importSpec(imp)}' from ` +
            `'${donor.name}': collides with another name`
         );
      }
      
      return {
         dG: {
            imports: $.rel.update(G.imports, $.rel.addFact, imp),
            modules: $.rel.update(G.modules, $.rel.alterFact, recp, $.patchModule, {
               nsDelta: {
                  [imp.importedAs]: name === '' ? donor.ns : donor.ns[name]
               }
            })
         }
      }
   },
})
Gcopy ::= function (G) {
   return {
      modules: $.rel.copy(G.modules),
      imports: $.rel.copy(G.imports)
   }
}
importSpec ::= function ({entry, alias}) {
   if (entry === null) {
      return `* as: ${alias}`;
   }
   else if (alias === null) {
      return entry;
   }
   else {
      return `${entry} as: ${alias}`
   }
}
importablesInto ::= function (recp, modules, imports) {
   function encodeEntry(moduleName, entryName) {
      return JSON.stringify([moduleName, entryName]);
   }

   function decodeEntry(encoded) {
      return JSON.parse(encoded);
   }

   let importables = new Set;

   for (let module of modules) {
      if (module.id === recp.id) {
         continue;
      }

      for (let e of module.members) {
         importables.add(encodeEntry(module.name, e));
      }
      importables.add(encodeEntry(module.name, ''));
   }

   // Exclude those already imported
   for (let imp of $.trie.values($.rel.at(imports.into, recp.id))) {
      importables.delete(
         encodeEntry($.trie.at(modules.byId, imp.donorid).name, imp.entry)
      );
   }

   return Array.from(importables, decodeEntry);
}
setEntryDef ::= function (mG, mid, entryName, newDef) {
   let module = $.trie.at(mG.modules.byId, mid);
   let newVal = $.moduleEval(module.ns, newDef);
   
   $.rel.alterFact(mG.modules, module, $.patchModule, {
      nsDelta: {
         [entryName]: newVal
      },
      entries: $.rel.update(module.entries, $.rel.patchFactByPk, entryName, {
         strDef: newDef,
         def: newDef
      })
   });
   
   // Propagate newVal to recipients
   let eimps = $.rel.at(mG.imports.from, module.id, entryName);
   
   for (let imp of eimps) {
      $.rel.alterFactByPk(mG.modules, imp.recpid, $.patchModule, {
         nsDelta: {
            [imp.importedAs]: newVal
         }
      })
   }
}
offendingModulesOnRename ::= function* (mG, mid, oldName, newName) {
   let eimps = $.rel.at(mG.imports.from, mid, oldName);
   
   for (let imp of eimps) {
      if (imp.alias === null) {
         let recp = $.trie.at(mG.modules.byId, imp.recpid);
         if ($.isNameBound(recp, newName, mG.imports)) {
            yield recp;
         }
      }
   }
}
changeImportsForRename ::= function (mG, mid, oldName, newName) {
   let eimps = Array.from($.rel.at(mG.imports.from, mid, oldName));
   
   for (let imp of eimps) {
      if (imp.alias !== null) {
         continue;
      }
      
      $.rel.alterFactByPk(mG.modules, imp.recpid, recp => $.patchModule(recp, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: recp.ns[oldName]
         }
      }));
   }
   
   $.rel.alterFacts(mG.imports, eimps, $.patchObj, {entry: newName});
}
changeReferrersForRename ::= function (mG, mid, oldName, newName) {
   let emap = $.rel.at(mG.imports.from, mid, oldName);
   let smap = $.rel.at(mG.imports.from, mid, '');
   
   let recpids = new Set($.concat($.trie.keys(emap), $.trie.keys(smap)));
   
   for (let recpid of recpids) {
      let renames = new Map;
      
      let eimp = $.trie.tryAt(emap, recpid);
      if (eimp !== undefined && eimp.alias === null) {
         renames.set(oldName, newName);
      }
      
      let simp = $.trie.tryAt(smap, recpid);
      if (simp !== undefined) {
         renames.set($.joindot(simp.alias, oldName), $.joindot(simp.alias, newName));
      }
      
      $.renameRefs(mG, recpid, renames);
   }
}
renameRefs ::= function (mG, mid, renames) {
   if (renames.size === 0) {
      return;
   }
   
   let alts = Array.from(renames.keys(), name => name.replace(/\./g, '\\.'));
   let re = new RegExp(`(?<=\\$\\.)(?:${alts.join('|')})\\b`, 'g');
   
   for (let entry of $.trie.at(mG.modules.byId, mid).entries) {
      let newDef = entry.def.replace(re, renames.get.bind(renames));
      
      if (newDef !== entry.def) {
         $.setEntryDef(mG, mid, entry.name, newDef);
      }
   }
}
moduleNames ::= function* (module, imports) {
   yield* module.members;
   yield* $.trie.keys($.trie.at(imports.into, module.id, $.trie.makeEmpty));
}
isNameBound ::= function (module, name, imports) {
   return (
      $.trie.hasAt(module.entries.byName, name) ||
      $.trie.hasAt(imports.into, module.id, name)
   );
}
isNameFree ::= function (module, name, imports) {
   return !$.isNameBound(module, name, imports);
}
patchModule ::= function (module, patch) {
   let nsDelta = $.patchNullableObj(module.nsDelta, patch.nsDelta);
   return {...module, ...patch, nsDelta};
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
