export {Root, VirtualRoot};

import {specialize} from '$/poli/common/generic.js';
import {dependOn, invalidate, onDepInvalidated} from './mechanics.js';


class Root {
  value;

  constructor(value) {
    this.value = value;
  }

  get v() {
    dependOn(this);

    return this.value;
  }

  set v(value) {
    this.value = value;

    invalidate(this);
  }
}


class VirtualRoot {
  accessor;

  constructor(accessor) {
    this.accessor = accessor;
  }

  get v() {
    dependOn(this);

    return this.accessor();
  }

  invalidate() {
    invalidate(this);
  }
}


function onInvalidateRoot(root) {
  return true;
}


specialize(onDepInvalidated, Root, onInvalidateRoot);
specialize(onDepInvalidated, VirtualRoot, onInvalidateRoot);


Root.prototype.isPersistentCell = true;
VirtualRoot.prototype.isPersistentCell = true;
