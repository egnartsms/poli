const {load} = require('./run');


if (require.main === module) {
   let modules = load();
   modules['img2fs'].rtobj['main']();
}