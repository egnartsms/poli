import {Registry} from './registry.js';
import {digest} from './engine.js';


/**
 * @param modulesData: [{
 *    name,
 *    lang,
 *    imports: [{donor, imports: [{name, alias}]}],
 *    body: [{target, definition}]
 * }]
 * return: Map { module name -> namespace object }
 */
export function loadModulesData(modulesData) {
   let reg = new Registry();

   for (let mdata of modulesData) {
      reg.loadModuleData(mdata);
   }

   digest();

   reg.switchToRuntime();
   return reg.moduleNsMap();
}


// const reIdentifier = /^([a-z][a-z0-9_$]*)$/i;
