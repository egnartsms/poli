import {Registry} from './registry';
import {digest} from './engine';


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

   reg.populateModuleNamespaces();
   return reg.moduleNsMap();
}


// const reIdentifier = /^([a-z][a-z0-9_$]*)$/i;
