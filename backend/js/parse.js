import {SRC_FOLDER} from './const';


/**
 * @param raw: {type, lang, name, contents}
 * @return: {
 *    name,
 *    lang,
 *    imports: [{donor, imports: [{name, alias}]}],
 *    body: [{target, definition}]
 * }
 */
export function parseRawModule(raw) {
   let imports, body;

   try {
      ({imports, body} = parseModuleContents(raw.contents));
   }
   catch (e) {
      console.error(`Could not parse module '${raw.name}'`);
      throw e;
   }

   return {
      name: raw.name,
      lang: raw.lang,
      imports: imports,
      body: body
   }
}


function parseModuleContents(str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = parseModuleImports(rawImports);
   let body = parseModuleBody(rawBody);

   return {imports, body};
}


const reModuleName = /^[\w-]+$/;
const reImportLine = /^(?<entry>\S+?)(?:\s+as:\s+(?<alias>\S+?))?$/;  // it's trimmed


function parseModuleImports(str) {
   let res = [];

   for (let [[,donor], rawImports] of headerSplit(str, /^(?=\S)(.+?)\n/gm)) {
      if (!reModuleName.test(donor)) {
         throw new Error(`Bad module name to import: '${donor}'`);
      }

      let imports = [];

      for (let line of rawImports.split(/\n/)) {
         line = line.trim();

         if (line === '') {
            continue;
         }

         let mtch = reImportLine.exec(line);

         if (mtch === null) {
            throw new Error(`Invalid import line: '${line}'`);
         }

         imports.push({
            name: mtch.groups.entry === '*' ? null : mtch.groups.entry,
            alias: mtch.groups.alias ?? null
         })
      }

      res.push({
         donor,
         imports
      });
   }

   return res;
}


const reDocstring = ` {3}:.*\\n(?:(?: *\\n)* {4,}\\S.*\\n)*`;
const reDef = `(?:(?: *\\n)* .*\\n)*`;
const reBody = `(?<docstring>${reDocstring})?(?<def>${reDef})`;

const reEntry = new RegExp(
   `^(?<target>\\S.*?) +::=(?: *\\n(?<body>${reBody})| +(?<oneliner>.+)\\n)`,
   'gm'
);


function parseModuleBody(str) {
   let entries = [];

   for (let [mtch, interspace] of headerSplit(str, reEntry)) {
      if (mtch === null) {
         // Leading interspace is skipped
         continue;
      }
      
      entries.push({
         target: mtch.groups.target,
         definition: mtch.groups.oneliner ?? mtch.groups.def
      })
   }

   return entries;
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      ... HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.

   Yield pairs [header_match, body]. For the first header, if something precedes it, we
   yield [null, body0].
*/
function* headerSplit(str, reHeader) {
   let prev_i = 0, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (mtch.index > 0) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }

      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}
