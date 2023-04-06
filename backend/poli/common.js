export function assert(callback) {
  if (!callback()) {
    throw new Error(`Assert failed`);
  }
}


/**
 * This is just to make IIFE look a bit nicer.
 */
export function call(fn) {
  return fn();
}


export function isAllSpaces(str) {
  return /^\s*$/.test(str);
}


export function copyProps(dest, source, props) {
  for (let prop of props) {
    dest[prop] = source[prop];
  }
}


export function* map(xs, func) {
  for (let x of xs) {
    yield func(x);
  }
}


export function addAll(container, xs) {
  for (let x of xs) {
    container.add(x);
  }
}


export function deleteAll(container, xs) {
  for (let x of xs) {
    container.delete(x);
  }
}


export function methodFor(klass, method) {
  if (Object.hasOwn(klass.prototype, method.name)) {
    throw new Error(`Duplicate method '${method.name}' for '${klass.name}'`);
  }

  klass.prototype[method.name] = method;
}
