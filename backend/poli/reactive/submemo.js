export {submemo};

import {specialize} from '$/poli/common/generic.js';
import {
  free, onDepInvalidated, trackingDepsOf, unlinkFromDeps, beingTracked, dependOn
} from './mechanics.js';


class Submemo {
  func;
  value;
  deps = new Set;

  constructor(func) {
    this.func = func;
    this.value = trackingDepsOf(this, this.func);
  }
}


specialize(onDepInvalidated, Submemo, function (submemo) {
  unlinkFromDeps(submemo);

  return () => {
    let newValue = trackingDepsOf(submemo, submemo.func);

    return (newValue !== submemo.value);
  };
});


function submemo(func) {
  if (beingTracked.at(-1) === null) {
    throw new Error(`Submemo can only be used within some other computation`);
  }

  let submemo = new Submemo(func);

  dependOn(submemo);

  return submemo.value;
}
