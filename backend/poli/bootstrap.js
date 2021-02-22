-----
util ::= $_.require('util')
fs ::= $_.require('fs')
assert ::= $_.require('assert').strict
lobby ::= null
modules ::= null
makeImageByFs ::= function () {
   $.modules = {};

   let modulesInfo = $.parseAllModules();
   let jsModulesInfo = modulesInfo.filter(mi => mi.lang === 'js');

   // Phase 0: make JS modules and fully prepare them to operate
   for (let {name, body} of jsModulesInfo) {
      $.modules[name] = $.makeJsModule(name, body);
   }

   for (let minfo of jsModulesInfo) {
      $.addModuleInfoImports(minfo);
   }
   
   $.effectuateImports('js');

   // Phase 1: make XS modules
   let xsModulesInfo = modulesInfo.filter(mi => mi.lang === 'xs');
   $.modules['xs-bootstrap'].rtobj['makeModulesByInfo'](xsModulesInfo);
   
   // Phase 2: save the whole object graph to the persistent storage
   // (Lobby exists in the DB but is empty at this point)
   $.lobby = {
      modules: $.modules,
      bootstrapDefs: $.modules[$_.BOOTSTRAP_MODULE].defs
   };
   $.obj2id = new WeakMap([[$.lobby, $_.LOBBY_OID]]);
   
   let uow = $.makeUow();
   $.saveObject($.lobby, uow);
   $.flushUow(uow);
}
parseAllModules ::= function () {
   let modulesInfo = [];

   for (let moduleFile of $.fs.readdirSync($_.SRC_FOLDER)) {
      let res = $.parseModuleFile(moduleFile);
      if (res === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }
      
      let {name, lang} = res;
      let contents = $.fs.readFileSync(`./${$_.SRC_FOLDER}/${moduleFile}`, 'utf8');
      let {imports, body} = $.parseModule(contents);
      let moduleInfo = {
         name: name,
         lang: lang,
         imports: imports,
         body: body
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
         rawImports.matchAll(/^\s+(?<entry>.*?)(?:\s+as:\s+(?<alias>.+?))?\s*$/gm)
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
parseModuleFile ::= function (moduleFile) {
   let mtch = /^(?<name>.+)\.(?<lang>js|xs)$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}
makeJsModule ::= function (name, body) {
   let module = {
      [$.skRuntimeKeys]: ['rtobj'],
      lang: 'js',
      name: name,

      // Import/export information is filled later
      imports: new Set(),
      exports: new Set(),
      importedNames: new Set(),
      
      entries: Array.from(body, ([entry]) => entry),
      // in JS, trim entry src definitions
      defs: Object.fromEntries(body.map(([entry, src]) => [entry, src.trim()])),

      rtobj: null
   };
   
   $.evalJsModuleDefinitions(module);

   return module;
}
evalJsModuleDefinitions ::= function (module) {
   $.assert(module.lang === 'js');
   $.assert(module.rtobj === null);
   
   if (module.name === $_.BOOTSTRAP_MODULE) {
      module.rtobj = $;
   }
   else {
      module.rtobj = Object.create(null);
      for (let entry of module.entries) {
         module.rtobj[entry] = $.moduleEval(module, module.defs[entry]);
      }
   }
}
addModuleInfoImports ::= function ({name, imports}) {
   let recp = $.modules[name];
   for (let {donor: donorName, asterisk, imports: importrecs} of imports) {
      let donor = $.modules[donorName];
      if (asterisk !== null) {
         $.import({recp, donor, name: null, alias: asterisk});
      }
      for (let {entry, alias} of importrecs) {
         $.import({recp, donor, name: entry, alias});
      }
   }
}
importedAs ::= function (imp) {
   return imp.alias || imp.name;
}
import ::= function (imp) {
   // This function is only for use while creating image from files. It's not intended
   // to be reused in other modules.
   //
   // Perform import 'imp' but don't touch modules' rtobjs. That will be done separately.

   $.validateImport(imp);
   
   imp.recp.importedNames.add($.importedAs(imp));
   imp.recp.imports.add(imp);
   imp.donor.exports.add(imp);
}
validateImport ::= function (imp) {
   $.assert(!imp.recp.imports.has(imp));
   $.assert(!imp.donor.exports.has(imp));

   if (imp.name === null) {
      $.validateStarImport(imp);
   }
   else {
      $.validateEntryImport(imp);
   }
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
effectuateImports ::= function (inLang) {
   for (let recp of Object.values($.modules)) {
      if (inLang && recp.lang !== inLang) {
         continue;
      }

      for (let imp of recp.imports) {
         recp.rtobj[$.importedAs(imp)] =
            imp.name === null ? imp.donor.rtobj : imp.donor.rtobj[imp.name];
      }
   }
}
skSet ::= '__set'
skMap ::= '__map'
skRuntimeKeys ::= '__rtkeys'
skRef ::= '__ref'
obj2id ::= null
nextOid ::= $_.LOBBY_OID + 1
takeNextOid ::= function () {
   return $.nextOid++;
}
stmtReplace ::= $_.db.prepare(`
   INSERT OR REPLACE INTO obj(id, val) VALUES (?, ?)
`)
isObject ::= function (val) {
   return typeof val === 'object' && val !== null;
}
makeUow ::= function () {
   return {
      newobj2id: new Map,  // new objects (not already on $.obj2id)
      savelist: [],    // [[oid, "serialized to JSON"], ...]
      discovered: [],  // new objects waiting to be further examined
   }
}
uowoid ::= function (uow, obj) {
   $.assert($.isObject(obj));

   let oid = $.obj2id.get(obj);
   if (!oid) {
      oid = uow.newobj2id.get(obj);
      if (!oid) {
         oid = $.takeNextOid();
         uow.newobj2id.set(obj, oid);
         uow.discovered.push(obj);
      }
   }

   return oid;
}
saveObject ::= function (obj, uow) {
   $.assert($.isObject(obj));

   let oid = $.obj2id.get(obj);

   if (oid) {
      uow.savelist.push([oid, $.toJson(obj, uow)]);
   }
   else {
      $.uowoid(uow, obj);
   }   

   while (uow.discovered.length > 0) {
      let obj = uow.discovered.pop();
      uow.savelist.push([uow.newobj2id.get(obj), $.toJson(obj, uow)]);
   }
}
toJson ::= function (obj, uow) { 
   let runtimeKeys = obj[$.skRuntimeKeys] || [];

   if (obj instanceof Set) {
      obj = {
         [$.skSet]: Array.from(obj),
         ...obj
      }
   }

   function ref(val) {
      return (
         $.isObject(val) ? {
            [$.skRef]: $.uowoid(uow, val)
         } : val
      );      
   }

   return JSON.stringify(obj, function (key, val) {
      if (val === obj) {
         return val;
      }

      if (this !== obj) {
         // We are at some nested level (e.g. [$.skSet]: [item, ...])
         return ref(val);
      }

      // Special keys should not be touched
      if (key === $.skRuntimeKeys || key === $.skSet) {
         return val;
      }

      if (runtimeKeys.includes(key)) {
         return null;
      }
      
      return ref(val);
   });
}
flushUow ::= function (uow) {
   $.assert(uow.discovered.length === 0);

   for (let pair of uow.savelist) {
      $.stmtReplace.run(pair);
   }

   uow.savelist.length = 0;
   uow.newobj2id.clear();
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
   let obj2plain = new Map;

   let data = $_.db.prepare(`SELECT id, val FROM obj ORDER BY id ASC`).raw().all();

   for (let [id, val] of data) {
      let plain = JSON.parse(val);
      let obj;

      if (plain[$.skSet]) {
         obj = new Set;
         obj2plain.set(obj, plain);
      }
      else {
         obj = plain;
      }

      obj2id.set(obj, id);
      id2obj.set(id, obj);
   }

   $.nextOid = data[data.length - 1][0] + 1;

   function isref(v) {
      return $.isObject(v) && $.hasOwnProperty(v, $.skRef);
   }

   function noref(v) {
      if (!isref(v)) {
         return v;
      }

      let obj = id2obj.get(v[$.skRef]);
      if (!obj) {
         throw new Error(`The image is corrupted: object by ID ${refid} is missing`);
      }

      return obj;
   }

   function derefObject(obj) {
      for (let [k, v] of Object.entries(obj)) {
         if (isref(v)) {
            obj[k] = noref(v);
         }
      }
   }

   for (let obj of obj2id.keys()) {
      if (obj instanceof Set) {
         let plain = obj2plain.get(obj);
         
         for (let item of plain[$.skSet]) {
            obj.add(noref(item));
         }

         for (let [k, v] of Object.entries(plain)) {
            if (k !== $.skSet) {
               obj[k] = noref(v);
            }
         }
      }
      else {
         derefObject(obj);
      }
   }

   $.lobby = id2obj.get($_.LOBBY_OID);
   $.modules = $.lobby.modules;
   $.obj2id = new WeakMap(obj2id);

   $.animateJsModules();
   $.effectuateImports('js');
   $.modules['xs-bootstrap'].rtobj['animateXsModules']();
   $.effectuateImports('xs');

   return $.modules;
}
animateJsModules ::= function () {
   // Initialize JS modules' rtobj's
   for (let module of Object.values($.modules)) {
      if (module.lang === 'js') {
         $.evalJsModuleDefinitions(module);
      }
   }   
}
