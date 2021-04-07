const fs = require('fs');
const {SRC_FOLDER} = require('./const');


function readRawModules() {
   let modules = [];

   for (let filename of fs.readdirSync(SRC_FOLDER)) {
      let res = parseModuleFilename(filename);
      if (res === null) {
         console.warn(`Encountered file "${filename}" which is not Poli module. Ignored`);
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
   let mtch = /^(?<name>.+)\.(?<lang>js|xs)$/.exec(filename);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}


module.exports = readRawModules;
