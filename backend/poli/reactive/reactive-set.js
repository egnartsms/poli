export {ReactiveSet};


import {methodFor} from '$/poli/common/generic.js';


function ReactiveSet() {
  this.set = new Set;
  this.watchers = new Set;
}


methodFor(ReactiveSet, function addWatcher(watcher) {
  this.watchers.add(watcher);
});


methodFor(ReactiveSet, function removeWatcher(watcher) {
  this.watchers.remove(watcher);
});


methodFor(ReactiveSet, function add(item) {
  if (this.set.has(item)) {
    return;
  }

  this.set.add(item);

  for (let watcher of this.watchers) {
    watcher.add(item);
  }
});


methodFor(ReactiveSet, function remove(item) {
  if (!this.set.has(item)) {
    throw new Error;
  }

  this.set.delete(item);

  for (let watcher of this.watchers) {
    watcher.remove(item);
  }
});
