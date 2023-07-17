export {
  beingTracked, trackingDepsOf, notTrackingDeps, dependOn, invalidate,
  unlinkFromDeps, onDepInvalidated, free, externallyDepends,
  unlinkFromExternalDeps
};


import {Queue} from '$/poli/queue.js';
import {assert, addAll, emptying, popSetItem} from '$/poli/common.js';
import {MultiMap} from '$/poli/common/multimap.js';
import {generic} from '$/poli/common/generic.js';


let beingTracked = [null];


function trackingDepsOf(cell, fnBody) {
  if (beingTracked.includes(cell)) {
    throw new Error("Circular cell dependency detected");
  }

  beingTracked.push(cell);

  try {
    return fnBody();
  }
  finally {
    beingTracked.pop();
  }
}


function notTrackingDeps(fnBody) {
  beingTracked.push(null);

  try {
    return fnBody();
  }
  finally {
    beingTracked.pop();
  }
}


let revdeps = new MultiMap;


function dependOn(Bcell) {
  let Acell = beingTracked.at(-1);

  if (Acell === null || Acell.deps.has(Bcell)) {
    return;
  }

  Acell.deps.add(Bcell);
  revdeps.add(Bcell, Acell);
}


const free = generic(function free(cell) {
  unlinkFromDeps(cell);
});


// TODO: figure out how to use it
let beingUsed = new Set;


function isAlive(cell) {
  return (
    cell.isPersistentCell === true || revdeps.hasAt(cell) || beingUsed.has(cell)
  );
}


function unlinkRevdep(cell, revdep) {
  revdeps.remove(cell, revdep);

  if (!isAlive(cell)) {
    free(cell);
  }
}


function unlinkFromDeps(cell) {
  for (let dep of cell.deps) {
    unlinkRevdep(dep, cell);
  }

  cell.deps.clear();
}


const onDepInvalidated = generic(
  function onDepInvalidated(cell, dep) {
    free(cell);

    return true;
  }
);


function invalidate(cell) {
  if (!revdeps.hasAt(cell)) {
    return;
  }

  let invq = new Queue;
  let callbacks = new Queue;

  function proceed(cell, res) {
    if (res === true) {
      for (let revdep of revdeps.valuesAt(cell)) {
        invq.enqueue({cell: revdep, dep: cell});
      }
    }
    else if (res === false)
      ;
    else if (typeof res === 'function') {
      callbacks.enqueue({cell, callback: res});
    }
    else {
      throw new Error(`onDepInvalidated protocol violation`);
    }
  }

  proceed(cell, onDepInvalidated(cell, null));

  while (!invq.isEmpty || !callbacks.isEmpty) {
    while (!invq.isEmpty) {
      let {cell, dep} = invq.dequeue();

      if (revdeps.has(dep, cell)) {
        proceed(cell, onDepInvalidated(cell, dep));
      }
    }

    while (!callbacks.isEmpty) {
      let {cell, callback} = callbacks.dequeue();

      if (isAlive(cell)) {
        proceed(cell, callback());
        break;
      }
    }
  }
}


const externalDeps = new MultiMap;


function externallyDepends(cell, dep) {
  externalDeps.add(cell, dep);
  revdeps.add(dep, cell);
}


function unlinkFromExternalDeps(cell) {
  for (let dep of externalDeps.valuesAt(cell)) {
    revdeps.remove(dep, cell);
  }

  externalDeps.removeAt(cell);
}
