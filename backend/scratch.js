import {generateImportmap} from './script/importmap.js';


generateImportmap({urlPrefix: '/static'}).then(console.log);
