export {
  Leaf, VirtualLeaf, Computed, derived, invalidate, mountEffect
}


import {assert, addAll, MultiMap} from '$/poli/common.js';
import {Queue} from '$/poli/queue.js';
import {Result} from '$/poli/result.js';


class LogicError extends Error {}


let beingComputed = [];


function compute(cell, func) {
  if (beingComputed.includes(cell)) {
    throw new LogicError("Circular cell dependency detected");
  }

  beingComputed.push(cell);

  try {
    return func();
  }
  finally {
    beingComputed.pop();
  }
}


function computeWrap(cell, func) {
  try {
    return Result.plain(compute(cell, func));
  }
  catch (exc) {
    if (exc instanceof LogicError) {
      throw exc;
    }

    return Result.exception(exc);
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
  let invQueue = new Set;
  let callbacks = new Queue;

  invQueue.add(cell);

  function writeDown(res) {
    let {doLater, invalidate} = res ?? {};

    if (doLater) {
      callbacks.enqueue(doLater);
    }

    if (invalidate) {
      addAll(invQueue, invalidate);
    }
  }

  for (;;) {
    while (invQueue.size > 0) {
      let [cell] = invQueue;

      invQueue.delete(cell);

      let more;

      if (cell.onInvalidate) {
        writeDown(cell.onInvalidate());
      }
      else {
        addAll(invQueue, cell.revdeps);
      }
    }

    if (callbacks.isEmpty) {
      break;
    }

    let callback = callbacks.dequeue();

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
    return this.accessor();
  }
}


const invalidated = new Object;

const invalidationHooks = new Map;


class Computed {
  func;
  value = invalidated;
  deps = new Set;
  revdeps = new Set;

  constructor(func) {
    this.func = func;
  }

  get v() {
    dependOn(this);

    if (this.isInvalidated) {
      this.value = compute(this, this.func);
    }

    return this.value;
  }

  get isInvalidated() {
    return this.value === invalidated;
  }

  onInvalidate() {
    this.value = invalidated;
    unlinkDeps(this);

    if (invalidationHooks.has(this)) {
      invalidationHooks.get(this)();
    }

    return {invalidate: this.revdeps};
  }

  addInvalidationHook(hook) {
    if (invalidationHooks.has(this)) {
      throw new Error(`Multiple hooks for a computed cell not supported yet`);
    }

    invalidationHooks.set(this, hook);

    if (this.isInvalidated) {
      hook();
    }
  }
}


// let invalidationSets = new MultiMap;


// function addToInvalidationSet(cell, set) {
//   invalidationSets.add(cell, set);

//   if (cell.isInvalidated) {
//     set.add(cell);
//   }
// }


class Derived {
  func;
  value;
  deps = new Set;
  revdep = null;

  constructor(func) {
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
    unlinkDeps(this);

    return {
      doLater: () => {
        let newValue = compute(this, this.func);

        if (newValue !== this.value) {
          return {invalidate: [this.revdep]};
        }
      }
    }
  }
}


function derived(func) {
  if (beingComputed.length === 0) {
    throw new Error(
      `Derived computation can only run within some other computation`
    );
  }

  return (new Derived(func)).value;
}


class Effect {
  deps = new Set;
  undo = null;

  onInvalidate() {
    unlinkDeps(this);
    this.undo();
  }
}


function mountEffect(body) {
  let effect = new Effect;

  try {
    effect.undo = compute(effect, body);
  }
  catch (e) {
    unlinkDeps(effect);
    throw e;
  }
}
