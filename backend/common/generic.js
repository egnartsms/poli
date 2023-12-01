import {arrayify} from './data.js';


/**
 * methodFor(klasses, method)
 * methodFor(klasses, name, method)
 */
export function methodFor(klasses) {
   let method, name;

   if (arguments.length === 3) {
      name = arguments[1];
      method = arguments[2];
   }
   else if (arguments.length === 2) {
      method = arguments[1];
      name = method.name;
   }
   else
      throw new Error();

   for (let klass of arrayify(klasses)) {
      if (Object.hasOwn(klass.prototype, name)) {
         throw new Error(`Duplicate method '${name}' for '${klass.name}'`);
      }

      klass.prototype[name] = method;
   }
}


export function propertyFor(klass, getter) {
   Object.defineProperty(klass.prototype, {
      configurable: true,
      enumerable: true,
      get: getter
   });
}
