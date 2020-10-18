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
            $.doImport({recp, donor, name: null, alias: asterisk});
         }
         for (let {entry, alias} of imports) {
            $.doImport({recp, donor, name: entry, alias});
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
   let mtch = /^(?<module_name>.+?)\.js$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return mtch.groups['module_name'];
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
            throw new Error(
               `Corrupted image: module "${minfo.name}" imports "${importedAs}" from ` +
               `"${donor}" which collides with another module member or import`
            );
         }
         entries.add(importedAs);
      }
   }
}
skRuntimeKeys ::= '__rtkeys'
skRef ::= '__ref'
skType ::= '__type'
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
isObject ::= function (obj) {
   return typeof obj === 'object' && obj !== null;
}
toJson ::= function (obj, objref) {
   if (obj instanceof Set) {
      return JSON.stringify({
         [$.skType]: 'set',
         'contents': Array.from(obj, x => {
            return $.isObject(x) ? objref(x) : x;
         })
      });
   }

   let runtimeKeys = obj[$.skRuntimeKeys] || [];

   return JSON.stringify(obj, function (key, val) {
      if (val === obj || this !== obj) {
         return val;
      }

      if (runtimeKeys.includes(key)) {
         return null;
      }

      if (!$.isObject(val)) {
         return val;
      }

      if (key === $.skRuntimeKeys) {
         return val;
      }

      return objref(val);
   });
}
saveObject ::= function (obj) {
   $.assert($.isObject(obj));

   let rec = $.objrefRecorder();
   let oid = $.obj2id.get(obj);
   let json = $.toJson(obj, rec.objref);
   if (oid == null) {
      oid = $.takeNextOid();
      $.stmtInsert.run({oid, val: json});
      $.obj2id.set(obj, oid);
   }
   else {
      $.stmtUpdate.run({oid, val: json});
   }

   $.addRecordedObjects(rec);
}
objrefRecorder ::= function () {
   let toAdd = new Map();

   function objref(obj) {
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

   return {toAdd, objref};
}
addRecordedObjects ::= function ({toAdd, objref}) {
   function addObject(obj, oid) {
      let json = $.toJson(obj, objref);
      $.stmtInsert.run({oid, val: json});
      $.obj2id.set(obj, oid);
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
doImport ::= function (imp) {
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
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
moduleEval ::= function (module, code) {
   let fun = new Function('$_, $, $$', `return (${code})`);
   return fun.call(null, $_, module.rtobj, module);
}
loadImage ::= function () {
   let symPlaceholder = Symbol('placeholder');

   function placeholderFor(refid) {
      return {
         [symPlaceholder]: true,
         refid
      };
   }

   function isPlaceholder(x) {
      return $.isObject(x) && x[symPlaceholder];
   }

   let data = $_.db.prepare(`SELECT id, val FROM obj ORDER BY id ASC`).all();
   let id2obj = new Map();

   for (let {id, val} of data) {
      let obj = JSON.parse(val, function (k, v) {
         if (!$.isObject(v)) {
            return v;
         }

         if (typeof v[$.skRef] === 'number') {
            return placeholderFor(v[$.skRef]);
         }

         return v;
      });

      $.obj2id.set(obj, id);
      id2obj.set(id, obj);
   }

   $.nextOid = data[data.length - 1].id + 1;

   // Now resolve object references
   let unusedRefids = new Set(id2obj.keys());

   function getByRefid(refid) {
      unusedRefids.delete(refid);
      let obj = id2obj.get(refid);
      if (obj == null) {
         throw new Error(`The image is corrupted: object by ID ${refid} is missing`);
      }
      return obj;
   }

   function some(itbl, pred) {
      for (let x of itbl) {
         if (pred(x)) {
            return true;
         }
      }

      return false;
   }

   for (let obj of $.obj2id.keys()) {
      let target;
      if (obj[$.skType] === 'persistent-set') {
         target = obj['items'];
      }
      else {
         target = obj;
      }

      let entries = Object.entries(target).filter(([k, v]) => isPlaceholder(v));
      for (let [k, ph] of entries) {
         target[k] = getByRefid(ph.refid);
      }
   }

   unusedRefids.delete($_.LOBBY_OID);
   if (unusedRefids.size > 0) {
      console.warn(`Found ${unusedRefids.size} isolated garbage objects`);
      for (let refid of unusedRefids) {
         console.log(
            $.util.inspect(id2obj.get(refid), {
               depth: 1
            })
         );
      }
   }

   // Now make real persistent set objects
   let obj2highlvl = new Map;
   for (let obj of $.obj2id.keys()) {
      if (obj[$.skType] === 'persistent-set') {
         // Continue here...
         obj
      }
   }

   $.lobby = id2obj.get($_.LOBBY_OID);
   $.modules = $.lobby.modules;
   $.imports = $.lobby.imports;

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
emptyPersistentSet ::= function () {
   return {
      nextid: 1,
      item2id: new Map
   }
}
persistentSetFromJson ::= function (nextid, items) {
   let item2id = new Map;
   for (let [id, item] of Object.entries(items)) {
      item2id.set(item, id);
   }

   return {
      nextid,
      item2id
   }
}
persistentSetToJson ::= function (pset) {
   return {
      [$.skType]: 'persistent-set',
      nextid: pset.nextid,
      items: Object.fromEntries(
         Array.from(pset.item2id, ([item, id]) => [id, item])
      )
   }
}
