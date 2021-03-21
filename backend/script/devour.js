const {loadPoli} = require('./load');
const {readRawModules} = require('./raw');


if (require.main === module) {
   let modules = loadPoli(readRawModules());
   modules['img2fs'].rtobj['main']();
}