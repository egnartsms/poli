-----
assert ::= function (cond) {
   if (!cond) {
      throw new Error;
   }
}
modules ::= ({})
load ::= function (rawModules) {
   let modulesInfo = $.parseModules(rawModules);

   $.loadJs(modulesInfo.filter(mi => mi.lang === 'js'));
   $.loadXs(modulesInfo.filter(mi => mi.lang === 'xs'));

   return $.modules;
}
loadJs ::= function (modulesInfo) {
   for (let {name, body} of modulesInfo) {
      $.modules[name] = $.makeJsModule(name, body);
   }

   for (let minfo of modulesInfo) {
      $.addModuleInfoImports(minfo);
   }

   // Don't forget to flush the changes to modules' rtobjs. We don't really need to go
   // through this transactional behavior now during the load process. The reason we do 
   // this is that we want to reuse this code in other modules of the system (by just 
   // importing from 'bootstrap' which is perfectly fine)
   $.rtflush();
}
loadXs ::= function (modulesInfo) {
   let xsBootstrap = $.modules['xs-bootstrap'];
   xsBootstrap.rtobj['load'](modulesInfo);
}
parseModules ::= function (rawModules) {
   let modulesInfo = [];

   for (let raw of Object.values(rawModules)) {
      let {imports, body} = $.parseModule(raw.contents);
      let moduleInfo = {
         name: raw.name,
         lang: raw.lang,
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
makeJsModule ::= function (name, body) {
   // Make JS module, evaluate its entries but don't do any imports yet
   let module = {
      lang: 'js',
      name: name,

      // Import/export information is filled later
      imports: new Set(),
      exports: new Set(),
      importedNames: new Set(),
      
      entries: Array.from(body, ([entry]) => entry),
      // in JS, trim entry src definitions
      defs: Object.fromEntries(body.map(([entry, src]) => [entry, src.trim()])),

      rtobj: name === $_.BOOTSTRAP_MODULE ? $ : Object.create(null),
      delta: Object.create(null)
   };
   
   if (module.name !== $_.BOOTSTRAP_MODULE) {
      for (let entry of module.entries) {
         $.rtset(module, entry, $.moduleEval(module, module.defs[entry]));
      }
   }

   return module;
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
   $.validateImport(imp);
   
   let {recp, donor, name} = imp;

   recp.importedNames.add($.importedAs(imp));
   recp.imports.add(imp);
   donor.exports.add(imp);

   $.rtset(
      recp,
      $.importedAs(imp),
      name === null ? donor.rtobj : $.rtget(donor, name)
   );
}
validateImport ::= function (imp) {
   let importedAs = $.importedAs(imp);
   let {recp, donor, name, alias} = imp;

   // This check does only make sense for entry imports (not star imports)
   if (name !== null && !$.hasOwnProperty(donor.defs, name)) {
      throw new Error(
         `Module '${recp.name}': cannot import '${name}' from '${donor.name}': ` +
         `no such definition`
      );
   }
   if ($.hasOwnProperty(recp.defs, importedAs)) {
      throw new Error(
         `Module '${recp.name}': imported name '${importedAs}' from the module ` +
         `'${donor.name}' collides with own definition`
      );
   }
   if (recp.importedNames.has(importedAs)) {
      throw new Error(
         `Module '${recp.name}': the name '${importedAs}' imported more than once`
      );
   }
}
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
moduleEval ::= function (module, code) {
   let fun;

   try {
      fun = new Function('$_, $, $$', `"use strict"; return (${code});`);
   }
   catch (e) {
      console.error(`Parsing of this code failed: ${code}`);
      throw e;
   }

   try {
      return fun.call(null, $_, module.rtobj, module);
   }
   catch (e) {
      console.error(`Evaluation of this code failed: ${code}`);
      throw e;
   }
   
}
touchedModules ::= new Set
delmark ::= Object.create(null)
rtget ::= function (module, name) {
   if (name in module.delta) {
      let val = module.delta[name];
      return val === $.delmark ? undefined : val;
   }
   else {
      return module.rtobj[name];
   }
}
rtset ::= function (module, name, val) {
   module.delta[name] = val;
   $.touchedModules.add(module);
}
rtdel ::= function (module, name) {
   $.rtset(module, name, $.delmark);
}
rtflush ::= function () {
   for (let module of $.touchedModules) {
      for (let [name, val] of Object.entries(module.delta)) {
         if (val === $.delmark) {
            delete module.rtobj[name];
         }
         else {
            module.rtobj[name] = val;
         }
      }

      module.delta = Object.create(null);
   }
   
   $.touchedModules.clear();
}
rtdrop ::= function () {
   for (let module of $.touchedModules) {
      module.delta = Object.create(null);
   }

   $.touchedModules.clear();
}
