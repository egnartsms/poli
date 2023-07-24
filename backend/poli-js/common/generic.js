import {arrayify} from '$/poli/common.js';


export function methodFor(klasses, method) {
  for (let klass of arrayify(klasses)) {
    if (Object.hasOwn(klass.prototype, method.name)) {
      throw new Error(`Duplicate method '${method.name}' for '${klass.name}'`);
    }

    klass.prototype[method.name] = method;
  }
}


export function propertyFor(klass, fnGetter) {
  if (Object.hasOwn(klass.prototype, fnGetter.name)) {
    throw new Error(`Duplicate method '${fnGetter.name}' for '${klass.name}'`);
  }

  Object.defineProperty(klass.prototype, fnGetter.name, {
    configurable: true,
    enumerable: true,
    get: fnGetter
  });
}


/**
 * Usage examples:
 *   let capacity = generic('capacity')
 *   let capacity = generic(function capacity(...) { ... })
 * 
 * In the first case, the default method would just throw an exception.
 */
export function generic(default_or_name) {
  let name, defaultMethod;

  if (typeof default_or_name === 'string') {
    name = default_or_name;
    defaultMethod = function () {
      throw new Error(`Generic function '${name}' not defined for the object passed`);
    }
  }
  else if (typeof default_or_name === 'function') {
    defaultMethod = default_or_name;
    name = defaultMethod.name;
  }
  else {
    throw new Error(`Wrong usage`);
  }

  let gfunc = function (arg0) {
    return (arg0[gfunc.dispatch] ?? defaultMethod).apply(null, arguments);
  };

  gfunc.dispatch = Symbol(name);

  return gfunc;
}


export function specialize(gfunc, klass, method) {
  if (Object.hasOwn(klass.prototype, gfunc.dispatch)) {
    throw new Error(
      `Generic function ${gfunc.name} already specialized for the ' +
      'class '${klass.name}'`
    );
  }

  klass.prototype[gfunc.dispatch] = method;
}
