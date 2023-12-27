import { methodFor } from '$/common/generic.js';
import * as rv from '$/reactive';


export function init(module) {
   Object.assign(module, {
      bindings: new Map,
      ns: {__proto__: null},
   });
}


export function getBinding(module, name) {
   if (!module.bindings.has(name)) {
      module.bindings.set(name, makeBinding(module, name));
   }

   return module.bindings.get(name);
}


let tempid = 1;

function makeBinding(module, name) {
   return rv.makeEntity({
      module: module,
      name: name,
      id: tempid++
   });
}
