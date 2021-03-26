-----
assert ::= function (cond) {
   if (!cond) {
      throw new Error;
   }
}
modules ::= Object.create(null)
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
      imported: new Map,  // { importedAs -> <entry> }
      exported: new Map,  // { <entry> -> {<recp module> -> as} }

      entries: null,  // [<entry>], in order
      name2entry: null, // {name -> <entry>}
      starEntry: null,  // fake entry to express star imports

      rtobj: name === $_.BOOTSTRAP_MODULE ? $ : Object.create(null)
   };

   module.entries = Array.from(body, ([name, src]) => ({
      name: name,
      def: src.trim(),
      module: module
   }));

   module.name2entry = new Map(Array.from(module.entries, e => [e.name, e]));
   
   module.starEntry = {
      name: null,
      def: '*',
      module: module
   };

   if (module.name !== $_.BOOTSTRAP_MODULE) {
      for (let entry of module.entries) {
         module.rtobj[entry.name] = $.moduleEval(module, entry.def);
      }
   }

   return module;
}
addModuleInfoImports ::= function ({name, imports}) {
   let recp = $.modules[name];

   for (let {donor: donorName, asterisk, imports: importrecs} of imports) {
      let donor = $.modules[donorName];
      if (donor === undefined) {
         throw new Error(
            `Module '${recp.name}': cannot import from '${donorName}': no such module`
         );
      }

      if (asterisk !== null) {
         $.import(donor.starEntry, recp, asterisk);
      }

      for (let {name, alias} of importrecs) {
         let entry = donor.name2entry.get(name);
         if (entry === undefined) {
            throw new Error(
               `Module '${recp.name}': cannot import '${name}' from '${donor.name}': ` +
               `no such definition`
            );
         }
         
         $.import(entry, recp, alias || name);
      }
   }
}
import ::= function (entry, recp, as) {
   $.validateImport(entry, recp, as);
   
   recp.imported.set(as, entry);
   
   let donor = entry.module;

   if (!donor.exported.has(entry)) {
      donor.exported.set(entry, new Map);
   }
   donor.exported.get(entry).set(recp, as);
   
   recp.rtobj[as] = entry.name === null ? donor.rtobj : donor.rtobj[entry.name];
}
validateImport ::= function (entry, recp, as) {
   let importedAs = $.importedAs(imp);
   let {recp, donor, name, alias} = imp;

   if (recp.name2entry.has(as)) {
      throw new Error(
         `Module '${recp.name}': imported name '${as}' from the module ` +
         `'${entry.module.name}' collides with own definition`
      );
   }
   if (recp.imported.has(as)) {
      throw new Error(
         `Module '${recp.name}': the name '${as}' imported more than once`
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
