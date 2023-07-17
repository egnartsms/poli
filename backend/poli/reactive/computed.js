export {Computed};

import {methodFor, propertyFor} from '$/poli/common.js';
import {compute, unlinkFromDeps, dependOn, unlinkRevdep} from './computation.js';


const invalidated = new Object;


class Computed {
  func;
  value = invalidated;
  deps = new Set;
  revdeps = new Set;
  keep = true;  // if true, it's needed by someone except revdeps

  constructor(func) {
    this.func = func;
  }
}


function isInvalidated(cell) {
  return cell.value === invalidated;
}


propertyFor(Computed, function v() {
  dependOn(this);

  if (isInvalidated(this)) {
    this.value = compute(this, this.func);
  }

  return this.value;
});


methodFor(Computed, function unlinkRevdep(revdep) {
  this.revdeps.delete(revdep);
  checkForInvalidation(this);
});


methodFor(Computed, function invalidateBy(dep) {
  if (isInvalidated(this)) {
    return;
  }

  makeInvalidated(this);

  return {more: this.revdeps};
});


methodFor(Computed, function unkeep() {
  this.keep = false;

  checkForInvalidation(this);
});


function checkForInvalidation(cell) {
  if (!cell.keep && cell.revdeps.size === 0) {
    makeInvalidated(cell);
  }
}


function makeInvalidated(cell) {
  cell.value = invalidated;
  unlinkFromDeps(cell);
}
