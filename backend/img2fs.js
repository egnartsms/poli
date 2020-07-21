/// SQLite --> ./poli/**/*.js 
const fs = require('fs');
const {loadImage} = require('./run');

const {
   SRC_FOLDER,
   IMG2FS_MODULE
} = require('./common');


function main() {
   let modules = loadImage();
   let img2fs = modules.find(m => m.name === IMG2FS_MODULE);

   fs.rmdirSync(SRC_FOLDER, {recursive: true});
   fs.mkdirSync(SRC_FOLDER, {mode: '775'});

   img2fs.rtobj['main']();
}


if (require.main === module) {
   main();
}