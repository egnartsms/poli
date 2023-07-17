export {MultiMap};


class MultiMap {
  constructor() {
    this.map = new Map;
  }

  add(key, val) {
    let bag = this.map.get(key);

    if (bag === undefined) {
      bag = new Set();
      this.map.set(key, bag);
    }

    bag.add(val);
  }

  // delete(key, val) {
  //   let bag = this.map.get(key);

  //   if (bag === undefined) {
  //      return false;
  //   }

  //   let didDelete = bag.delete(val);

  //   if (bag.size === 0) {
  //     this.map.delete(key);
  //   }

  //   return didDelete;
  // }

  remove(key, val) {
    let bag = this.map.get(key);

    bag.delete(val);

    if (bag.size === 0) {
      this.map.delete(key);
    }
  }

  removeAt(key) {
    this.map.delete(key);
  }

  has(key, val) {
    return this.map.has(key) && this.map.get(key).has(val);
  }

  hasAt(key) {
    return this.map.has(key);
  }

  *valuesAt(key) {
    yield* this.map.get(key) ?? [];
  }
}
