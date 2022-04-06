const {SRC_FOLDER} = require('./const');


function loadModules(rawModules) {
   function moduleEval(ns, name, def) {
      def = def.replace(/(?<=^function\*? )(?= *\()/, name);
      let fun = Function('$', `"use strict";\n   return (${def})`);
      return fun.call(null, ns);
   }

   console.time('bootstrap');
   
   let minfos = Array.from(
      parseModules(rawModules), minfo => ({
         ...minfo,
         ns: Object.create(null)
      })
   );

   // Evaluate bodies
   for (let minfo of minfos) {
      if (minfo.lang !== 'js') {
         continue;
      }

      for (let {isBox, name, def} of minfo.body) {
         let value;

         try {
            value = moduleEval(minfo.ns, name, def);
         }
         catch (e) {
            console.error(`'${minfo.name}': failed to eval '${name}'`);
            throw e;
         }

         Object.defineProperty(minfo.ns, name, isBox ? makeBoxDescriptor(value) : {
            configurable: true,
            enumerable: true,
            value,
            writable: true
         });
      }
   }

   // Perform the imports
   for (let recp of minfos) {
      if (recp.lang !== 'js') {
         continue;
      }

      for (let {donor: donorName, asterisk, imports} of recp.imports) {
         let donor = minfos.find(m => m.name === donorName);

         if (donor === undefined) {
            throw new Error(
               `Module '${recp.name}': cannot import from '${donorName}:' ` +
               `no such module`
            );
         }

         if (asterisk !== null) {
            if (asterisk in recp.ns) {
               throw new Error(
                  `Module '${recp.name}': cannot import '* as ${asterisk}' from ` +
                  `'${donor.name}': collides with another name`
               );
            }

            Object.defineProperty(recp.ns, asterisk, {
               configurable: true,
               enumerable: true,
               value: donor.ns,
               writable: false
            });
         }

         for (let {entry, alias} of imports) {
            if (!(entry in donor.ns)) {
               throw new Error(
                  `Module '${recp.name}': cannot import '${entry}' from ` +
                  `'${donor.name}': no such definition`
               );
            }

            let importedAs = alias || entry;

            if (importedAs in recp.ns) {
               throw new Error(
                  `Module '${recp.name}': cannot import '${importedAs}' from ` +
                  `'${donor.name}': collides with another name`
               );
            }

            Object.defineProperty(
               recp.ns, importedAs, Object.getOwnPropertyDescriptor(donor.ns, entry)
            );
         }
      }
   }

   console.timeEnd('bootstrap');
   
   return minfos;
}


function makeBoxDescriptor(initial) {
   let value = initial;

   return {
      configurable: true,
      enumerable: true,
      get() {
         return value;
      },
      set(newValue) {
         value = newValue;
      }
   }
}

function parseModules(rawModules) {
   let modules = [];

   for (let raw of rawModules) {
      // TODO: remove this when you finally get to XS
      if (raw.lang === 'xs') {
         continue;
      }

      let imports, body;

      try {
         ({imports, body} = parseModule(raw.contents));
      }
      catch (e) {
         console.error(`Could not parse module '${raw.name}'`);
         throw e;
      }

      modules.push({
         name: raw.name,
         lang: raw.lang,
         imports: imports,
         body: body
      });
   }

   return modules;
}


function parseModule(str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = parseImports(rawImports);
   let body = parseBody(rawBody);

   return {imports, body};
}


const reModuleName = /^[\w-]+$/;
const reImportLine = /^(?<entry>\S+?)(?:\s+as:\s+(?<alias>\S+?))?$/;  // it's trimmed


function parseImports(str) {
   let res = [];

   for (let [[,donor], rawImports] of headerSplit(str, /^(?=\S)(.+?)\n/gm)) {
      if (!reModuleName.test(donor)) {
         throw new Error(`Bad module name to import: '${donor}'`);
      }

      let imports = [];
      let asterisk = null;

      for (let line of rawImports.split(/\n/)) {
         line = line.trim();

         if (!line) {
            continue;
         }

         let mtch = reImportLine.exec(line);

         if (mtch === null) {
            throw new Error(`Invalid import line: '${line}'`);
         }

         if (mtch.groups.entry === '*') {
            if (asterisk !== null) {
               throw new Error(`Multiple asterisk imports from module '${donor}'`)
            }

            asterisk = mtch.groups.alias;
         }
         else {
            imports.push({
               entry: mtch.groups.entry,
               alias: mtch.groups.alias ?? null
            })
         }
      }

      res.push({
         donor,
         asterisk,
         imports
      });
   }

   return res;
}


const reEntryName = /^(box +)?([a-z][a-z0-9_$]*)$/i;


function parseBody(str) {
   const reEntryHeader = /^(\w.*?) +::=/gm;
   let entries = [];

   for (let [[,entry], def] of headerSplit(str, reEntryHeader)) {
      let mtch = reEntryName.exec(entry);

      if (mtch === null) {
         throw new Error(`Could not parse this as entry name: '${entry}'`);
      }

      entries.push({
         isBox: mtch[1] !== undefined,
         name: mtch[2],
         def: def.trim()
      })
   }

   return entries;
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.

   Yield pairs [header_match, body]
*/
function* headerSplit(str, reHeader) {
   let prev_i = null, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (prev_mtch !== null) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }
      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}


module.exports = loadModules;