-----
fs ::= $_.require('fs')
assert ::= $_.require('assert').strict
lobby ::= null
modules ::= null
imports ::= null
makeAndLoadImageByFs ::= function () {
   let modulesInfo = $.parseAllModules();
   $.modules = {};
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeModule(name, body);
   }

   $.imports = new Set();
   $.imports.add({a: 10, b: 20});
   $.imports.add({a: 100, b: 200});
   
   // Lobby exists in the DB but is empty at this point
   $.lobby = {
      modules: $.modules,
      imports: $.imports,
      bootstrapDefs: $.modules[$_.BOOTSTRAP_MODULE].defs
   };
   $.idmap.set($.lobby, $_.LOBBY_OID);
   $.saveObjectAddCascade($.lobby);
}
parseAllModules ::= function () {
   let modulesInfo = [];

   for (let moduleFile of $.fs.readdirSync($_.SRC_FOLDER)) {
      let moduleName = $.moduleNameByFile(moduleFile);
      if (moduleName === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }

      let contents = $.fs.readFileSync(`./${$_.SRC_FOLDER}/${moduleFile}`, 'utf8');
      let {imports, body} = $.parseModule(contents);
      let moduleInfo = {
         name: moduleName,
         imports,
         body
      };

      $.validateModuleEntries(moduleInfo);

      modulesInfo.push(moduleInfo);
   }

   return modulesInfo;
}
parseModule ::= function (str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = $.parseImports(rawImports);
   let body = $_.parseBody(rawBody);

   return {imports, body};
}
parseImports ::= function (str) {
   let res = [];

   for (let [[,donor], rawImports] of $_.matchAllHeaderBodyPairs(str, /^(\S.*?)\s*\n/gm)) {
      let imports = Array.from(
         rawImports.matchAll(/^\s+(?<entry>.*?)(?:\s+as\s+(?<alias>.+?))?\s*$/gm)
      );

      if (imports.length === 0) {
         // This should not normally happen but not an error
         continue;
      }

      let asterisk = null;

      if (imports[0].groups.entry === '*') {
         asterisk = imports[0].groups.alias;
         imports.splice(0, 1);
      }

      res.push({
         donor,
         asterisk,
         imports: Array.from(imports, imp => ({
            entry: imp.groups.entry,
            alias: imp.groups.alias || null,
         }))
      });
   }

   return res;
}
moduleNameByFile ::= function (moduleFile) {
   let mtch = /^(?<module_name>.+?)\.poli\.js$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return mtch.groups.module_name;
}
validateModuleEntries ::= function (minfo) {
   let entries = new Set(minfo.body.map(([name]) => name));

   for (let {donor, asterisk, imports} of minfo.imports) {
      if (asterisk !== null) {
         if (entries.has(asterisk)) {
            throw new Error(
               `Corrupted image: module "${minfo.name}" imports "${donor}" as ` +
               `"${asterisk}" which collides with another module member or import`
            );
         }
         entries.add(asterisk);
      }

      for (let {entry, alias} of imports) {
         let importedAs = alias || entry;
         if (entries.has(importedAs)) {
            console.log("Here!!", entry, alias, minfo);
            throw new Error(
               `Corrupted image: module "${minfo.name}" imports "${importedAs}" from ` +
               `"${donor}" which collides with another module member or import`
            );
         }
         entries.add(importedAs);
      }
   }
}
metaRuntimeKeys ::= '__rtkeys'
metaRef ::= '__ref'
metaType ::= '__type'
idmap ::= new Map()
nextOid ::= 2
insertStmt ::= $_.db.prepare(`
   INSERT INTO obj(id, val) VALUES (:oid, :val)
`)
updateStmt ::= $_.db.prepare(`
   UPDATE obj SET val = :val WHERE id = :oid
`)
isObject ::= function (obj) {
   return typeof obj === 'object' && obj !== null;
}
toJson ::= function (obj, makeObjRef) {
   let runtimeKeys = obj[$.metaRuntimeKeys] || [];

   return JSON.stringify(obj, function (key, val) {
      if (val === obj) {
         if (val instanceof Set) {
            return {
               [$.metaType]: 'set',
               'contents': Array.from(val, x => {
                  return $.isObject(x) ? makeObjRef(x) : x;
               })
            };
         }
         else {
            return val;
         }      
      }

      if (this !== obj) {
         return val;
      }

      if (runtimeKeys.includes(key)) {
         return null;
      }

      if (!$.isObject(val)) {
         return val;
      }

      if (key === $.metaRuntimeKeys) {
         return val;
      }

      return makeObjRef(val);
   });
}
saveObjectAddCascade ::= function (obj) {
   $.assert($.isObject(obj));

   let toAdd = new Map();

   function objref(obj) {
      let oid = $.idmap.get(obj);
      if (oid == null) {
         oid = toAdd.get(obj);
         if (oid == null) {
            oid = $.nextOid++;
            toAdd.set(obj, oid);
         }
      }

      return {
         [$.metaRef]: oid
      };
   }

   function addObject(obj, oid) {
      let json = $.toJson(obj, objref);
      $.insertStmt.run({oid, val: json});
      $.idmap.set(obj, oid);
   }

   function saveObject(obj) {
      let oid = $.idmap.get(obj);
      let json = $.toJson(obj, objref);
      if (oid == null) {
         oid = $.nextOid++;
         $.insertStmt.run({oid, val: json});
         $.idmap.set(obj, oid);
      }
      else {
         $.updateStmt.run({oid, val: json});
      }
   }

   saveObject(obj);

   while (toAdd.size > 0) {
      let {value: [obj, oid]} = toAdd.entries().next();
      addObject(obj, oid);
      toAdd.delete(obj);
   }
}
makeModule ::= function (name, body) {
   let defs = {};

   for (let [entry, src] of body) {
      defs[entry] = {
         type: 'native',
         src
      };
   }

   let module = {
      [$.metaRuntimeKeys]: ['rtobj'],
      name,
      importedNames: new Set(),  // filled in on import resolve
      entries: Array.from(body, ([entry]) => entry),
      defs: defs,
      rtobj: null
   };

   if (name === $_.BOOTSTRAP_MODULE) {
      module.rtobj = $;
   }
   else {
      module.rtobj = Object.create(null);
      for (let [entry, src] of body) {
         module.rtobj[entry] = $.moduleEval(module, src);
      }
   }

   return module;
}
importEntry ::= function (recp, donor, name, alias) {
   let importedAs = alias || name;

   if (!(name in donor.defs)) {
      throw new Error(
         `Module "${recp.name}": cannot import "${name}" from "${donor.name}": ` +
         `no such definition`
      );
   }
   if (importedAs in recp.defs) {
      throw new Error(
         `Module "${recp.name}": cannot import "${importedAs}" from the module ` +
         `"${donor.name}": the name collides with own definition`
      );
   }
   if (recp.importedNames.has(importedAs)) {
      throw new Error(
         `Module "${recp.name}": the name "${importedAs}" imported from multiple ` +
         `modules`
      );         
   }

   recp.importedNames.add(importedAs);
   recp.rtobj[importedAs] = donor.rtobj[name];

   $.imports.add({
      recp,
      donor,
      name,
      alias,
      get importedAs() {
         return this.alias || this.name
      }
   });
}
importModule ::= function (recp, donor, alias) {
   if (alias in recp.defs) {
      throw new Error(
         `Module "${recp.name}": cannot import "${donor.name}" as "${alias}": ` +
         `the name collides with own definition`
      );
   }
   if (recp.importedNames.has(alias)) {
      throw new Error(
         `Module "${recp.name}": the name "${alias}" imported from multiple modules`
      );
   }

   recp.importedNames.add(alias);
   recp.rtobj[alias] = donor.rtobj;

   $.imports.add({
      recp,
      donor,
      name: null,
      alias,
      get importedAs() {
         return this.alias;
      }
   })
}
moduleEval ::= function (module, code) {
   let fun = new Function('$_, $, $$', `return (${code})`);
   return fun.call(null, $_, module.rtobj, module);
}
main ::= function () {
   let moduleNames = $_.db.prepare(`SELECT name FROM module`).pluck().all();
   let stmtEntries = $_.db.prepare(`
      SELECT name, def, prev
      FROM entry
      WHERE module_name = :module_name
   `);

   for (let moduleName of moduleNames) {
      let entries = stmtEntries.all({module_name: moduleName});
      entries = $.orderModuleEntries(entries, 'name', 'prev');
      $.modules[moduleName] = $.makeModuleObject(moduleName, entries);
   }

   let imports = $_.db.prepare(`SELECT * FROM any_import`).all();

   for (let {
            recp_module_name,
            donor_module_name,
            name,
            alias
         } of imports) {
      let recp = $.modules[recp_module_name];
      let donor = $.modules[donor_module_name];

      if (name === null) {
         $.importModule(recp, donor, alias);
      }
      else {
         $.importEntry(recp, donor, name, alias);
      }
   }

   return Object.values($.modules);
}
