class Leaf {
  revdeps = new Set;

  constructor() {
    this.revdeps = new Set;

  }
}


class VirtualLeaf {
  constructor() {
    this.revdeps = new Set;
  }

  invalidate() {
    for (let cell of this.revdeps) {
      cell.invalidate();
    }
  }
}


function invalidate(cell) {

}
