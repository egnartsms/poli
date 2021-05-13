common
   assert
   compare
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
G ::= null
main ::= function (sendMessage) {
   return msg => $.handleMessage(msg, sendMessage);
}
pendingState ::= null
commitPendingState ::= function (msg) {
   $.assert($.pendingState !== null);

   if (msg['type'] !== 'modify-code-result') {
      throw new Error(`Expected 'modify-code-result' message, got: ${msg['type']}`);
   }

   if (msg['success']) {
      $.loader.Gstate = $.pendingState;
      
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

   $.pendingState = null;
}
handleMessage ::= function (msg, sendMessage) {
   if ($.pendingState !== null) {
      $.commitPendingState(msg);
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

      $.G = $.Gcopy(G);

      let result = $.operationHandlers[msg['op']](msg['args']);
      let actions = $.statesDelta(G, $.G);

      if (actions.length > 0) {
         console.log("Code modifications:", actions);
         $.pendingState = $.G;
      }

      $.G = null;

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
moduleByName ::= function (name) {
   return $.trie.at($.G.modules.byName, name, () => {
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
   getEntries: function () {
      let res = [];
      
      for (let module of $.G.modules) {
         for (let entryName of module.members) {
            res.push([module.name, entryName]);
         }
      }
      
      return res;
   },
   
   getModuleNames: function ({module: moduleName}) {
      let module = $.moduleByName(moduleName);
      
      return Array.from($.moduleNames(module));
   },

   getNameAt: function ({module: moduleName, at}) {
      let module = $.moduleByName(moduleName);

      return $.vec.at(module.members, at);
   },
   
   getDefinition: function ({module: moduleName, name}) {
      let module = $.moduleByName(moduleName);
      let entry = $.entryByName(module, name);

      return entry.strDef;
   },
   
   getCompletions: function ({module: moduleName, star, prefix}) {
      let module = $.moduleByName(moduleName);
      
      let targetModule;

      if (star === null) {
         targetModule = module;
      }
      else {
         let simp = $.trie.tryAt($.G.imports.into, module.id, star);
         if (simp === undefined || simp.name) {
            return [];
         }

         targetModule = $.trie.at($.G.modules.byId, simp.donorid);
      }

      let res = [];

      for (let name of $.moduleNames(targetModule)) {
         if (name.startsWith(prefix)) {
            res.push(name);
         }
      }

      return res;
   },
   
   getImportables: function ({recp: recpName}) {
      let {id: mid} = $.moduleByName(recpName);

      return $.importablesInto(mid);
   },

   findReferences: function ({module: moduleName, star, name}) {
      let {id: mid} = $.moduleByName(moduleName);
      let {mid: oMid, entry: oEntry} = $.resolveReference(mid, star, name);
      
      if (oMid === undefined) {
         return null;
      }
      
      let res = [[$.trie.at($.G.modules.byId, oMid).name, oEntry]];
      
      for (let imp of $.importsOf(oMid, oEntry)) {
         res.push([$.trie.at($.G.modules.byId, imp.recpid).name, imp.importedAs]);
      }
      
      for (let imp of $.importsOf(oMid, '')) {
         res.push([
            $.trie.at($.G.modules.byId, imp.recpid).name,
            $.joindot(imp.alias, oEntry)
         ]);
      }
      
      res.sort(([m1, n1], [m2, n2]) => m1 !== m2 ? $.compare(m1, m2) : $.compare(n1, n2));
      
      return res;
   },
   
   editEntry: function ({module: moduleName, name, newDef}) {
      let module = $.moduleByName(moduleName);
      $.entryByName(module, name);
      
      $.setEntryDef(module.id, name, newDef.trim());
   },
   
   renameEntry: function ({module: moduleName, index, newName}) {
      let module = $.moduleByName(moduleName);
      let oldName = $.vec.at(module.members, index);
      $.entryByName(module, oldName);
      
      if ($.isNameBound(newName, module)) {
         throw $.genericError(
            `Module '${module.name}': name '${newName}' already defined or imported`
         );
      }
      
      let offendingModules = Array.from(
         $.offendingModulesOnRename(module.id, oldName, newName)
      );

      if (offendingModules.length > 0) {
         throw $.genericError(
            `Cannot rename to "${newName}": name conflict in modules: ` +
            `${offendingModules.map(m => m.name).join(',')}`
         );
      }

      $.changeReferrersForRename(module.id, oldName, newName);
      $.changeImportsForRename(module.id, oldName, newName);
      $.rel.alterFactByPk($.G.modules, module.id, module => $.patchModule(module, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: module.ns[oldName]
         },
         members: $.vec.update(module.members, $.vec.setAt, index, newName),
         entries: $.rel.update(
            module.entries, $.rel.patchFactByPk, oldName, {name: newName}
         ),
      }));
   },

   addEntry: function ({module: moduleName, name, def, index}) {
      let module = $.moduleByName(moduleName);

      if ($.isNameBound(name, module)) {
         throw $.genericError(
            `Module '${module.name}': name '${name}' already defined or imported`
         );
      }

      def = def.trim();
      let val = $.moduleEval(module.ns, def);

      $.rel.alterFact($.G.modules, module, $.patchModule, {
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
   
   moveBy1: function ({module: moduleName, name, direction}) {
      let module = $.moduleByName(moduleName);
      $.entryByName(module, name);
      
      if (direction !== 'up' && direction !== 'down') {
         throw $.genericError(`Invalid direction name: '${direction}'`);
      }

      let i = $.indexOf(module.members, name);
      let j = direction === 'up' ?
               (i === 0 ? $.vec.size(module.members) - 1 : i - 1) :
               (i === $.vec.size(module.members) - 1 ? 0 : i + 1);

      $.rel.alterFact($.G.modules, module, $.patchModule, {
         members: $.vec.update(module.members, members => {
            $.vec.deleteAt(members, i);
            $.vec.insertAt(members, j, name);
         })
      })
   },
   
   import: function ({recp: recpName, donor: donorName, name, alias}) {
      let recp = $.moduleByName(recpName);
      let donor = $.moduleByName(donorName);

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
      
      if ($.isNameBound(imp.importedAs, recp)) {
         throw $.genericError(
            `Module '${recp.name}': cannot import '${$.importSpec(imp)}' from ` +
            `'${donor.name}': collides with another name`
         );
      }
      
      $.rel.addFact($.G.imports, imp);
      $.rel.alterFact($.G.modules, recp, $.patchModule, {
         nsDelta: {
            [imp.importedAs]: name === '' ? donor.ns : donor.ns[name]
         }
      });
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
whereNameCame ::= function (mid, name) {
   if ($.trie.hasAt($.trie.at($.G.modules.byId, mid).entries.byName, name)) {
      return {
         mid: mid,
         entry: name
      };
   }

   let imp = $.trie.tryAt($.G.imports.into, mid, name);
   if (imp !== undefined) {
      return {
         mid: imp.donorid,
         entry: imp.entry
      };
   }
   
   return {};
}
resolveReference ::= function (mid, star, name) {
   if (star !== null) {
      let {mid: oMid, entry: oEntry} = $.whereNameCame(mid, star);
      
      if (oMid === undefined) {
         return {};
      }
      
      if (oEntry !== '') {
         // this is '$$.member.field', so star is not really a star reference
         return {
            mid: oMid,
            entry: oEntry
         };
      }
      
      if (!$.trie.hasAt($.trie.at($.G.modules.byId, oMid).entries.byName, name)) {
         return {};
      }
      
      return {
         mid: oMid,
         entry: name
      };
   }
   else {
      return $.whereNameCame(mid, name);
   }
}
importablesInto ::= function (mid) {
   function encodeEntry(moduleName, entryName) {
      return JSON.stringify([moduleName, entryName]);
   }

   function decodeEntry(encoded) {
      return JSON.parse(encoded);
   }

   let importables = new Set;

   for (let module of $.G.modules) {
      if (module.id === mid) {
         continue;
      }

      for (let e of module.members) {
         importables.add(encodeEntry(module.name, e));
      }
      importables.add(encodeEntry(module.name, ''));
   }

   // Exclude those already imported
   for (let imp of $.importsInto(mid)) {
      importables.delete(
         encodeEntry($.trie.at($.G.modules.byId, imp.donorid).name, imp.entry)
      );
   }

   return Array.from(importables, decodeEntry);
}
importsOf ::= function (mid, entryName) {
   return Array.from($.trie.values($.rel.groupAt($.G.imports.from, mid, entryName)));
}
importsInto ::= function (mid) {
   return Array.from($.trie.values($.rel.groupAt($.G.imports.into, mid)));
}
setEntryDef ::= function (mid, entryName, newDef) {
   let module = $.trie.at($.G.modules.byId, mid);
   let newVal = $.moduleEval(module.ns, newDef);
   
   $.rel.alterFact($.G.modules, module, $.patchModule, {
      nsDelta: {
         [entryName]: newVal
      },
      entries: $.rel.update(module.entries, $.rel.patchFactByPk, entryName, {
         strDef: newDef,
         def: newDef
      })
   });
   
   // Propagate newVal to recipients
   let eimps = $.importsOf(module.id, entryName);
   
   for (let imp of eimps) {
      $.rel.alterFactByPk($.G.modules, imp.recpid, $.patchModule, {
         nsDelta: {
            [imp.importedAs]: newVal
         }
      })
   }
}
offendingModulesOnRename ::= function* (mid, oldName, newName) {
   let eimps = $.importsOf(mid, oldName);
   
   for (let imp of eimps) {
      if (imp.alias === null) {
         let recp = $.trie.at($.G.modules.byId, imp.recpid);
         if ($.isNameBound(newName, recp)) {
            yield recp;
         }
      }
   }
}
changeImportsForRename ::= function (mid, oldName, newName) {
   let eimps = $.importsOf(mid, oldName);
   
   for (let imp of eimps) {
      if (imp.alias !== null) {
         continue;
      }
      
      $.rel.alterFactByPk($.G.modules, imp.recpid, recp => $.patchModule(recp, {
         nsDelta: {
            [oldName]: $.delmark,
            [newName]: recp.ns[oldName]
         }
      }));
   }
   
   $.rel.alterFacts($.G.imports, eimps, $.patchObj, {entry: newName});
}
changeReferrersForRename ::= function (mid, oldName, newName) {
   let emap = $.trie.copy($.rel.groupAt($.G.imports.from, mid, oldName));
   let smap = $.trie.copy($.rel.groupAt($.G.imports.from, mid, ''));
   
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
      
      $.renameRefs(recpid, renames);
   }
   
   $.renameRefs(mid, new Map([[oldName, newName]]));
}
renameRefs ::= function (mid, renames) {
   if (renames.size === 0) {
      return;
   }
   
   let alts = Array.from(renames.keys(), name => name.replace(/\./g, '\\.'));
   let re = new RegExp(`(?<=\\$\\.)(?:${alts.join('|')})\\b`, 'g');
   
   for (let entry of $.trie.at($.G.modules.byId, mid).entries) {
      let newDef = entry.def.replace(re, renames.get.bind(renames));
      
      if (newDef !== entry.def) {
         $.setEntryDef(mid, entry.name, newDef);
      }
   }
}
moduleNames ::= function* (module) {
   yield* module.members;
   yield* Array.from($.trie.keys($.rel.groupAt($.G.imports.into, module.id)));
}
isNameBound ::= function (name, module) {
   return (
      $.trie.hasAt(module.entries.byName, name) ||
      $.trie.hasAt($.G.imports.into, module.id, name)
   );
}
isNameFree ::= function (name, module) {
   return !$.isNameBound(name, module);
}
patchModule ::= function (module, patch) {
   return {
      ...module,
      ...patch,
      nsDelta: $.patchNullableObj(module.nsDelta, patch.nsDelta)
   };
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
