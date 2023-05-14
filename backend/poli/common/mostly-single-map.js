export class MostlySingleMap {
  single = new Map;
  multi = new Map;

  add(key, val) {
    if (this.multi.has(key)) {
      this.multi.get(key).add(val);
    }
    else if (this.single.has(key)) {
      let bag = new Set;

      bag.add(this.single.get(key));
      bag.add(val);

      this.multi.set(key, bag);
      this.single.delete(key);
    }
    else {
      this.single.set(key, val);
    }
  }

  popAt(key) {
    if (this.single.has(key)) {
      let val = this.single.get(key);

      this.single.delete(key);

      return val;
    }
    
    if (this.multi.has(key)) {
      let bag = this.multi.get(key);
      let [val] = bag;

      bag.delete(val);

      if (bag.size === 0) {
        this.multi.delete(key);
      }

      return val;
    }
    
    return undefined;
  }
}
