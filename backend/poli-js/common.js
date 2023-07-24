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


export function popSetItem(set) {
  if (set.size === 0) {
    return undefined;
  }

  let [item] = set;

  set.delete(item);

  return item;
}


export function arrayify(object) {
  return object instanceof Array ? object : [object];
}


export function* emptying(set) {
  while (set.size > 0) {
    let [item] = set;
    set.delete(item);
    yield item;
  }
}
