const fs = require('fs');


const {SRC_FOLDER} = require('./const');


function readRawModules() {
   let data = {};

   for (let filename of fs.readdirSync(SRC_FOLDER)) {
      let res = parseModuleFilename(filename);
      if (res === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }

      data[res.name] = {
         type: 'module',
         lang: res.lang,
         name: res.name,
         contents: fs.readFileSync(`./${SRC_FOLDER}/${filename}`, 'utf8')
      };
   }

   return data;
}


function parseModuleFilename(filename) {
   let mtch = /^(?<name>.+)\.(?<lang>js|xs)$/.exec(filename);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}


Object.assign(exports, {readRawModules});
