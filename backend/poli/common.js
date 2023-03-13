
export function assert (callback) {
  if (!callback()) {
    throw new Error(`Assert failed`);
  }
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


export function methodFor(klass, method) {
  if (Object.hasOwn(klass.prototype, method.name)) {
    throw new Error(`Duplicate method '${method.name}' for '${klass.name}'`);
  }

  klass.prototype[method.name] = method;
}
