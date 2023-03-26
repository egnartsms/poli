export function assert(callback) {
  if (!callback()) {
    throw new Error(`Assert failed`);
  }
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


export function methodFor(klass, method) {
  if (Object.hasOwn(klass.prototype, method.name)) {
    throw new Error(`Duplicate method '${method.name}' for '${klass.name}'`);
  }

  klass.prototype[method.name] = method;
}


export class MultiMap {
  bags = new Map;

  add(key, val) {
    let bag = this.bags.get(key);

    if (bag === undefined) {
       bag = new Set();
       this.bags.set(key, bag);
    }

    bag.add(val);
  }

  delete(key, val) {
    let bag = this.bags.get(key);

    if (bag === undefined) {
       return false;
    }

    let didDelete = bag.delete(val);

    if (bag.size === 0) {
       this.bags.delete(key);
    }

    return didDelete;
  }

  addToBag(key, vals) {
    let bag = this.bags.get(key);

    if (bag === undefined) {
      bag = new Set(vals);
      this.bags.set(key, bag);
    }
    else {
      addAll(bag, vals);
    }
  }

  deleteBag(key) {
    return this.bags.delete(key);
  }

  *itemsAt(key) {
    if (this.bags.has(key)) {
      yield* this.bags.get(key);
    }
  }

}
