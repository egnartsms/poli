const {loadPoli, readRawModules} = require('./run');


if (require.main === module) {
   let modules = loadPoli(readRawModules());
   modules['img2fs'].rtobj['main']();
}