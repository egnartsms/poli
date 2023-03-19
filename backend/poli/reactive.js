export {
  Leaf, VirtualLeaf, Computed, derived, registerInvalidationHook, invalidate
}


import {addAll} from '$/poli/common.js';
import {Queue} from '$/poli/queue.js';
import {Result} from '$/poli/eval.js';


let beingComputed = [];


function compute(cell, func) {
  if (beingComputed.includes(cell)) {
    throw new Error("Circular cell dependency detected");
  }

  beingComputed.push(cell);

  try {
    return func.call(null);
  }
  finally {
    beingComputed.pop();
  }
}


function computeWrap(cell, func) {
  if (beingComputed.includes(cell)) {
    throw new Error("Circular cell dependency detected");
  }

  beingComputed.push(cell);

  try {
    return Result.plain(func.call(null));
  }
  catch (e) {
    return Result.exception(e);
  }
  finally {
    beingComputed.pop();
  }
}


function dependOn(Bcell) {
  if (beingComputed.length === 0) {
    return;
  }

  let Acell = beingComputed.at(-1);

  if (Acell.deps.has(Bcell)) {
    return;
  }

  Acell.deps.add(Bcell);
  Bcell.revdeps.add(Acell);
}


function invalidate(cell) {
  let callbacks = [];
  let queue = new Set([cell]);

  function writeDown(res) {
    let {doLater, invalidate} = res ?? {};

    if (doLater) {
      callbacks.push(doLater);
    }

    if (invalidate) {
      addAll(queue, invalidate);
    }
  }

  for (;;) {
    while (queue.size > 0) {
      let [cell] = queue;

      queue.delete(cell);

      let more;

      if (cell.onInvalidate) {
        writeDown(cell.onInvalidate());
      }
      else {
        addAll(queue, cell.revdeps);
      }
    }

    let callback = callbacks.shift();

    if (callback === undefined) {
      break;
    }

    writeDown(callback());
  }
}


function unlinkDeps(cell) {
  for (let dep of cell.deps) {
    unlinkRevdep(dep, cell);
  }

  cell.deps.clear();
}


function unlinkRevdep(cell, revdep) {
  if (cell.unlinkRevdep) {
    cell.unlinkRevdep(revdep);
  }
  else {
    cell.revdeps.delete(revdep);
  }
}


class Leaf {
  value;
  revdeps = new Set;

  constructor(value) {
    this.value = value;
  }

  get v() {
    dependOn(this);
    return this.value;
  }

  set v(value) {
    invalidate(this);
    this.value = value;
  }
}


class VirtualLeaf {
  accessor;
  revdeps = new Set;

  constructor(accessor) {
    this.accessor = accessor;
  }

  get v() {
    dependOn(this);
    return this.accessor.call(null);
  }
}


class Computed {
  func;
  value = Result.unevaluated;
  deps = new Set;
  revdeps = new Set;

  constructor(func) {
    this.func = func;
  }

  get v() {
    dependOn(this);

    if (this.isInvalidated) {
      this.value = computeWrap(this, this.func);
    }

    return this.value.access();
  }

  get isInvalidated() {
    return this.value === Result.unevaluated;
  }

  onInvalidate() {
    this.value = Result.unevaluated;
    unlinkDeps(this);
    return {invalidate: this.revdeps};
  }
}


class Derived {
  func;
  value = Result.unevaluated;
  deps = new Set;
  revdep = null;

  constructor(func) {
    if (beingComputed.length === 0) {
      throw new Error(
        `Derived computation can only run within some other computation`
      );
    }

    this.func = func;
    this.value = compute(this, this.func);
    this.revdep = beingComputed.at(-1);
  }

  unlinkRevdep(revdep) {
    assert(() => revdep === this.revdep);

    this.revdep = null;
    unlinkDeps(this);
  }

  onInvalidate() {
    return {
      doLater: () => {
        unlinkDeps(this);

        let newValue = compute(this, this.func);

        if (newValue !== this.value) {
          return {invalidate: [this.revdep]};
        }
      }
    }
  }
}


function derived(func) {
  let derived = new Derived(func);

  return derived.value;
}


class InvalidationHook {
  constructor(cell, hook) {
    this.cell = cell;
    this.hook = hook;

    cell.revdeps.add(this);

    if (cell.isInvalidated) {
      hook.call(null);
    }
  }

  onInvalidate() {
    // Call the hook later but 'cell.revdeps' will still have 'this'.
    return {
      doLater: () => {
        this.hook.call(null);
      }
    }
  }

  unhook() {
    unlinkRevdep(this.cell, this);
  }
}


function registerInvalidationHook(cell, hook) {
  return new InvalidationHook(cell, hook);
}
