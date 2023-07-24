export {StabilityTracker};

import {specialize, methodFor} from '$/poli/common/generic.js';
import {onDepInvalidated, free, trackingDepsOf, unlinkFromDeps} from './mechanics.js';


function StabilityTracker(rset, func) {
  this.rset = rset;
  this.itemToCell = new Map;
  this.dirty = new Set;
  this.func = func;

  rset.addWatcher(this);
}


specialize(free, StabilityTracker, function (tracker) {
  tracker.rset.removeWatcher(tracker);
  for (let cell of tracker.itemToCell.values()) {
    unlinkFromDeps(cell);
  }
});


methodFor(StabilityTracker, function add(item) {
  this.dirty.add(item);
});


methodFor(StabilityTracker, function remove(item) {
  if (this.itemToCell.has(item)) {
    unlinkFromDeps(this.itemToCell.get(item));
    this.itemToCell.delete(item);
  }
  else if (this.dirty.has(item)) {
    this.dirty.delete(item);
  }
  else {
    throw new Error;
  }
});


methodFor(StabilityTracker, function reset() {
  for (let item of this.dirty) {
    let cell = new Cell(this, item);
    
    trackingDepsOf(cell, () => this.func(item));  // no interest in the value

    this.itemToCell.set(item, cell);
    this.dirty.delete(item);
  }
});


function Cell(parent, item) {
  this.parent = parent;
  this.item = item;
  this.deps = new Set;
}


specialize(onDepInvalidated, Cell, function (cell) {
  unlinkFromDeps(cell);

  let tracker = cell.parent;

  tracker.itemToCell.delete(cell.item);
  tracker.dirty.add(cell.item);

  return false;
});
