export {BidiMap};


import {methodFor} from '$/poli/common.js';


function BidiMap() {
  let invs = Object.create(BidiMap.prototype);

  let A = new Map;
  let B = new Map;

  initialize(this, A, B);
  initialize(invs, B, A);

  this.inverse = invs;
  invs.inverse = this;
}


function initialize(bidimap, A, B) {
  bidimap.A = A;
  bidimap.B = B;
  bidimap.inverse = null;
}


methodFor(BidiMap, function add(key, val) {
  if (this.A.has(key) || this.B.has(val)) {
    throw new Error(`Duplicate key/value`);
  }

  this.A.set(key, val);
  this.B.set(val, key);
});


methodFor(BidiMap, function pop(key) {
  if (!this.A.has(key)) {
    throw new Error(`Not found key`);
  }

  let val = this.A.get(key);

  this.A.delete(key);
  this.B.delete(val);

  return val;
});


methodFor(BidiMap, function at(key) {
  if (!this.A.has(key)) {
    throw new Error(`Not found key`);
  }

  return this.A.get(key);
});
