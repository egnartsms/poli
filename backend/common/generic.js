/**
 * Usage syntax:
 *
 * methodFor(klass, method)
 * methodFor(klass, name, method)
 * methodFor(klass, methodsObject)
 */
export function methodFor(klass) {
   let methods;

   if (arguments.length === 3) {
      let [, name, method] = arguments;
      
      methods = [[name, method]];
   }
   else if (arguments.length === 2) {
      let arg = arguments[1];

      if (typeof arg === 'function') {
         methods = [[arg.name, arg]];
      }
      else {
         methods = Object.entries(arg);
      }
   }
   else
      throw new Error;

   for (let [name] of methods) {
      if (Object.hasOwn(klass.prototype, name)) {
         throw new Error(`Duplicate method '${name}' for '${klass.name}'`);
      }
   }

   for (let [name, method] of methods) {
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
