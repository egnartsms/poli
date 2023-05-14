export {
  reactivePropertyFor,
  releaseReactivePropertyHolder
};


import {specialize} from '$/poli/common/generic.js';
import {free, dependOn, trackingDepsOf, unlinkFromDeps} from './mechanics.js';


let holders = new Map;


function reactivePropertyFor(klass, func) {
  let name = func.name;

  if (Object.hasOwn(klass.prototype, name)) {
    throw new Error(`Duplicate property '${name}' on class '${klass.name}'`);
  }

  let propKey = Symbol(name);

  function getter() {
    let bag = holders.get(this);

    if (bag === undefined) {
      bag = {};
      holders.set(this, bag);
    }

    let cell = bag[propKey];

    if (cell == null) {
      cell = bag[propKey] = new Cell(bag, propKey, func.bind(this));
    }

    dependOn(cell);

    return cell.value;
  }

  Object.defineProperty(klass.prototype, name, {
    configurable: true,
    enumerable: true,
    get: getter
  });
}


function releaseReactivePropertyHolder(holder) {
  let bag = holders.get(holder);

  if (bag === undefined) {
    return;  // no property was accessed
  }

  for (let cell of Object.values(bag)) {
    if (cell !== null) {
      unkeep(cell);
    }
  }

  holders.delete(holder);
}


function Cell(bag, propKey, func) {
  this.bag = bag;
  this.propKey = propKey;
  this.deps = new Set;
  this.value = null;

  this.value = trackingDepsOf(this, func);
}


specialize(free, Cell, function (cell) {
  unlinkFromDeps(cell);
  cell.bag[cell.propKey] = null;
});
