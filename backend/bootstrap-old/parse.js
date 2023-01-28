import {SRC_FOLDER} from './const.js';


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
const reImportBlock = /^(?=\S)(?<donor>.+)\n(?<lines>(?:(?!\S).*\n?)*)/gm;


function parseModuleImports(str) {
   let res = [];

   for (let match of str.matchAll(reImportBlock)) {
      let {donor, lines: rawImports} = match.groups;

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


const reDocstring = `\x20{3}:.*\\n(?:(?:\x20*\\n)*\x20{4,}\\S.*\\n)*`;
const reDef = `(?:(?:\x20*\\n)*\x20.*\\n)*`;
const reBody = `(?<docstring>${reDocstring})?(?<def>${reDef})`;

const reEntry = new RegExp(
   `^(?<target>\\S.*?)\x20+:(?<kind>.+?)?:=(?:\x20*\\n(?<multiliner>${reBody})|\x20+(?<oneliner>.+)\\n)`,
   'gm'
);


function parseModuleBody(str) {
   let entries = Array.from(str.matchAll(reEntry), match => {
      return {
         target: match.groups.target,
         definition: match.groups.oneliner ?? match.groups.def,
         kind: match.groups.kind ?? 'js'
      }
   });

   return entries;
}
