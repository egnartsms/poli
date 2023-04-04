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
}
