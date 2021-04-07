const {loadPoli, readAllModules} = require('./run');


if (require.main === module) {
   let modules = loadPoli(readAllModules());
   modules['img2fs'].rtobj['main']();
}