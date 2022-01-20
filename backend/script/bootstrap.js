var poli = (function () {
   'use strict';

   function loadModules(rawModules) {
      function moduleEval(ns, entry, code) {
         code = code.replace(/(?<=^ function\*? )(?=\()/, entry);
         let fun = Function('$', `"use strict";\n   return (${code})`);
         return fun.call(null, ns);
      }

      console.time('load');
      
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

         for (let [entry, code] of minfo.body) {
            try {
               minfo.ns[entry] = moduleEval(minfo.ns, entry, code);
            }
            catch (e) {
               console.error(`'${minfo.name}': failed to eval '${entry}'`);
               throw e;
            }
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

               recp.ns[asterisk] = donor.ns;
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

               recp.ns[importedAs] = donor.ns[entry];
            }
         }
      }

      console.timeEnd('load');
      
      return minfos;
   }


   function parseModules(rawModules) {
      let modules = [];

      for (let raw of rawModules) {
         let {imports, body} = parseModule(raw.contents);

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


   function parseImports(str) {
      let res = [];

      for (let [[,donor], rawImports] of matchAllHeaderBodyPairs(str, /^(\S.*?)\s*\n/gm)) {
         let imports = Array.from(
            rawImports.matchAll(/^\s+(?<entry>.*?)(?:\s+as:\s+(?<alias>.+?))?\s*$/gm)
         );

         if (imports.length === 0) {
            // This should not normally happen but not an error
            continue;
         }

         let asterisk = null;

         // TODO: check for asterisk at any index

         if (imports[0].groups.entry === '*') {
            asterisk = imports[0].groups.alias;
            imports.shift();
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


   function parseBody(str) {
      const re = /^(\S+?)\s+::=(?=\s)/gm;
      // Here we parse loosely but still require at least 1 space before and after '::='.
      // (::= can actually be followed immediately by a newline which is a whitespace, too)
      return Array.from(matchAllHeaderBodyPairs(str, re), ([mtch, def]) => [mtch[1], def]);
   }


   /**
    * Parse any kind of text separated with headers into header/body pairs:
         HEADER ... HEADER ... HEADER ...

      Everything following a header before the next header or the end of string is considered
      a body that belongs to that header.

      Yield pairs [header_match, body]
   */
   function* matchAllHeaderBodyPairs(str, reHeader) {
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


   var loadModules_1 = loadModules;

   function run(rawModules) {
      let minfos = loadModules_1(rawModules);
      
      {
         let mTest = minfos.find(m => m.name === 'test-dedb');
         mTest.ns['runTests']();
      }
      
      return;
   }


   run(/*RAW_MODULES*/);

   var bootstrap_template = {

   };

   return bootstrap_template;

}());
