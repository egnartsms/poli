import {arrayify} from './data.js';


export function methodFor(klasses, method) {
   for (let klass of arrayify(klasses)) {
      if (Object.hasOwn(klass.prototype, method.name)) {
         throw new Error(`Duplicate method '${method.name}' for '${klass.name}'`);
      }

      klass.prototype[method.name] = method;
   }
}
