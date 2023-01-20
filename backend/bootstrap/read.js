import fs from 'fs';

import {SRC_FOLDER} from './const.js';


/**
 * Read plain textual contents of all Poli modules.
 * 
 * @return [{type, lang, name, contents}]
 * */
export function readRawModules() {
   let modules = [];

   for (let filename of fs.readdirSync(SRC_FOLDER)) {
      let res = parseModuleFilename(filename);
      if (res === null) {
         continue;
      }

      modules.push({
         type: 'module',
         lang: res.lang,
         name: res.name,
         contents: fs.readFileSync(`./${SRC_FOLDER}/${filename}`, 'utf8')
      });
   }

   return modules;
}


function parseModuleFilename(filename) {
   let mtch = /^(?<name>.+)\.(?<lang>js)$/.exec(filename);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}
