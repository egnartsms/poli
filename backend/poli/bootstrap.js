-----
util ::= $_.require('util')
fs ::= $_.require('fs')
assert ::= $_.require('assert').strict
lobby ::= null
modules ::= null
imports ::= null
makeImageByFs ::= function () {
   $.modules = {};
   $.imports = new Set();

   let modulesInfo = $.parseAllModules();
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeModule(name, body);
   }

   for (let minfo of modulesInfo) {
      let recp = $.modules[minfo.name];
      for (let {donor: donorName, asterisk, imports} of minfo.imports) {
         let donor = $.modules[donorName];
         if (asterisk !== null) {
            $.import({recp, donor, name: null, alias: asterisk});
         }
         for (let {entry, alias} of imports) {
            $.import({recp, donor, name: entry, alias});
         }
      }
   }

   // Lobby exists in the DB but is empty at this point
   $.lobby = {
      modules: $.modules,
      imports: $.imports,
      bootstrapDefs: $.modules[$_.BOOTSTRAP_MODULE].defs
   };
   $.obj2id.set($.lobby, $_.LOBBY_OID);
   $.saveObject($.lobby);
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
   let mtch = /^(?<module_name>.+?)\.js$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return mtch.groups['module_name'];
}
import ::= function (imp) {
   if (imp.name === null) {
      $.validateStarImport(imp);
   }
   else {
      $.validateEntryImport(imp);
   }

   if (imp.name === null) {
      imp.recp.importedNames.add(imp.alias);
      imp.recp.rtobj[imp.alias] = imp.donor.rtobj;
   }
   else {
      let importedAs = imp.alias || imp.name;

      imp.recp.importedNames.add(importedAs);
      imp.recp.rtobj[importedAs] = imp.donor.rtobj[imp.name];
   }

   $.imports.add(imp);
}
validateEntryImport ::= function ({recp, donor, name, alias}) {
   let importedAs = alias || name;

   if (!$.hasOwnProperty(donor.defs, name)) {
      throw new Error(
         `Module "${recp.name}": cannot import "${name}" from "${donor.name}": ` +
         `no such definition`
      );
   }
   if ($.hasOwnProperty(recp.defs, importedAs)) {
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
}
validateStarImport ::= function ({recp, donor, alias}) {
   if ($.hasOwnProperty(recp.defs, alias)) {
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
}
skSet ::= '__set'
skMap ::= '__map'
skRuntimeKeys ::= '__rtkeys'
skRef ::= '__ref'
isRef ::= function (x) {
   return $.isObject(x) && $.hasOwnProperty(x, $.skRef);
}
initObjForPersistence ::= function (obj) {
   if (!(obj instanceof Set)) {
      return;
   }

   return $.initSetForPersistence(obj);
}
initSetForPersistence ::= function (set) {
   $.assert(set[$.skSet] == null);

   let nextid = 1;
   let item2id = new Map;
   for (let item of set) {
      item2id.set(item, nextid++);
   }

   Object.defineProperty(set, $.skSet, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: {nextid, item2id}
   });   
}
obj2id ::= new Map()
nextOid ::= 1
takeNextOid ::= function () {
   return $.nextOid++;
}
stmtInsert ::= $_.db.prepare(`
   INSERT INTO obj(id, val) VALUES (:oid, :val)
`)
stmtUpdate ::= $_.db.prepare(`
   UPDATE obj SET val = :val WHERE id = :oid
`)
isObject ::= function (val) {
   return typeof val === 'object' && val !== null;
}
toJson ::= function (obj, ref) { 
   let runtimeKeys = obj[$.skRuntimeKeys] || [];

   if (obj[$.skSet]) {
      let {nextid, item2id} = obj[$.skSet];

      obj = {
         [$.skSet]: {
            nextid,
            id2item: Object.fromEntries(
               function* () {
                  for (let [item, id] of item2id) {
                     yield [id, $.isObject(item) ? ref(item) : item];
                  }
               }()
            )
         },
         ...obj
      }
   } 

   return JSON.stringify(obj, function (key, val) {
      if (val === obj || this !== obj) {
         return val;
      }

      // Special keys should not be touched
      if (key === $.skRuntimeKeys || key === $.skSet) {
         return val;
      }

      if (runtimeKeys.includes(key)) {
         return null;
      }
      
      return $.isObject(val) ? ref(val) : val;
   });
}
saveObject ::= function (obj) {
   $.assert($.isObject(obj));

   let oid = $.obj2id.get(obj);
   let stmt;

   if (oid == null) {
      $.initObjForPersistence(obj);
      oid = $.takeNextOid();
      $.obj2id.set(obj, oid);
      stmt = $.stmtInsert;
   }
   else {
      stmt = $.stmtUpdate;
   }

   let rec = $.objrefRecorder();

   stmt.run({
      oid,
      val: $.toJson(obj, rec.ref)
   });

   $.addRecordedObjects(rec);
}
objrefRecorder ::= function () {
   let toAdd = new Map();

   function ref(obj) {
      $.assert($.isObject(obj));

      let oid = $.obj2id.get(obj);
      if (oid == null) {
         oid = toAdd.get(obj);
         if (oid == null) {
            oid = $.takeNextOid();
            toAdd.set(obj, oid);
         }
      }

      return {
         [$.skRef]: oid
      };
   }

   return {toAdd, ref};
}
addRecordedObjects ::= function ({toAdd, ref}) {
   function addObject(obj, oid) {
      $.initObjForPersistence(obj);
      $.obj2id.set(obj, oid);
      $.stmtInsert.run({oid, val: $.toJson(obj, ref)});
   }

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
      [$.skRuntimeKeys]: ['rtobj'],
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
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
moduleEval ::= function (module, code) {
   try {
      let fun = new Function('$_, $, $$', `return (${code})`);
      return fun.call(null, $_, module.rtobj, module);
   }
   catch (e) {
      console.error(`Could not eval: "${code}"`);
      throw e;
   }
}
loadImage ::= function () {
   let obj2id = new Map;
   let id2obj = new Map;
   let data = $_.db.prepare(`SELECT id, val FROM obj ORDER BY id ASC`).raw().all();

   for (let [id, val] of data) {
      let obj = JSON.parse(val);

      obj2id.set(obj, id);
      id2obj.set(id, obj);
   }

   $.nextOid = data[data.length - 1].id + 1;

   // 1. Resolve object references
   function getByRefid(refid) {
      let obj = id2obj.get(refid);
      if (obj == null) {
         throw new Error(`The image is corrupted: object by ID ${refid} is missing`);
      }
      return obj;
   }

   for (let obj of obj2id.keys()) {
      $.patchObjectTree(obj, (v) => {
         if ($.isRef(v)) {
            return getByRefid(v[$.skRef]);
         }
      });
   }

   // // 2. Create high-level objects
   // let low2high = new Map;

   // for (let obj of obj2id.keys()) {
   //    if ($.persistentType(obj) === $.persistent.set) {       
   //       low2high.set(obj, $.psetNew());
   //    }
   // }

   // // 3. Substitute low-level objects with high-level objects
   // for (let obj of obj2id.keys()) {
   //    $.patchObjectTree(obj, v => low2high.get(v));
   // }

   // for (let [obj, pset] of low2high) {
   //    $.psetResetWithLowLevel(pset, obj, low2high);
   //    let id = obj2id.get(obj);
   //    obj2id.delete(obj);
   //    obj2id.set(pset, id);
   //    id2obj.set(id, pset);
   // }

   // $.lobby = id2obj.get($_.LOBBY_OID);
   // $.modules = $.lobby.modules;
   // $.imports = $.lobby.imports;

   // Initialize module rtobj's
   for (let module of Object.values($.modules)) {
      if (module.name === $_.BOOTSTRAP_MODULE) {
         module.rtobj = $;
      }
      else {
         module.rtobj = Object.create(null);

         for (let entry of module.entries) {
            let def = module.defs[entry];
            if (def.type !== 'native') {
               throw new Error(`Unrecognized entry type: ${def.type}`);
            }

            module.rtobj[entry] = $.moduleEval(module, def.src);
         }
      }
   }

   // Now perform the imports
   for (let {recp, donor, name, alias} of $.imports) {
      recp.rtobj[alias || name] = (name === null ? donor.rtobj : donor.rtobj[name]);
   }

   return $.modules;
}
patchObjectTree ::= function (obj, patcher) {
   // obj must not be circular
   let objs = [obj];

   while (objs.length > 0) {
      let obj = objs.pop();

      for (let [k, v] of Object.entries(obj)) {
         let vv = patcher(v);
         if (vv != null) {
            obj[k] = vv;
         }
         else if ($.isObject(v)) {
            objs.push(v);
         }
      }
   }
}
