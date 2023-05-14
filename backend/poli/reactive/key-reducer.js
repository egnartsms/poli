export {KeyReducer};

import {methodFor, specialize} from '$/poli/common/generic.js';
import {free, trackingDepsOf, onDepInvalidated, unlinkFromDeps} from './mechanics.js';


/**
 * Reduce a set of keys and their mapped reactive values.
 */
function KeyReducer({rset, initial, valueOf, reduce, unreduce}) {
  this.keyToCell = new Map;
  this.dirty = new Set;
  this.value = initial;
  this.fnValueOf = valueOf;
  this.fnReduce = reduce;
  this.fnUnreduce = unreduce;

  rset.addWatcher(this);
}


specialize(free, KeyReducer, function (reducer) {
  reducer.rset.removeWatcher(reducer);
  for (let cell of reducer.keyToCell.values()) {
    unlinkFromDeps(cell);
  }
});


methodFor(KeyReducer, function add(key) {
  this.dirty.add(key);
});


methodFor(KeyReducer, function remove(key) {
  if (this.dirty.has(key)) {
    this.dirty.delete(key);
  }
  else if (this.keyToCell.has(key)) {
    // Remove of a valid key is performed eagerly
    let cell = this.keyToCell.get(key);

    unlinkFromDeps(cell);
    this.keyToCell.delete(key);

    setNewValue(this, this.fnUnreduce(this.value, key, cell.value));
  }
  else {
    throw new Error(`KeyReducer: attempt to remove missing key`);
  }
});


function setNewValue(reducer, newValue) {
  if (newValue !== undefined) {
    reducer.value = newValue;
  }
}


methodFor(KeyReducer, function ensureUpToDate() {
  for (let key of this.dirty) {
    let cell = new Cell(this, key);

    setNewValue(this, this.fnReduce(this.value, key, cell.value));

    this.keyToCell.set(key, cell);
    this.dirty.delete(key);
  }
});


function Cell(reducer, key) {
  this.reducer = reducer;
  this.key = key;
  this.deps = new Set;
  this.value = trackingDepsOf(this, () => reducer.fnValueOf(key));
}


specialize(onDepInvalidated, Cell, function (cell) {
  unlinkFromDeps(cell);

  let reducer = cell.reducer;

  reducer.keyToCell.delete(cell.key);
  reducer.dirty.add(cell.key);

  return false;
});
