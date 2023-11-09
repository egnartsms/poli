export {RvAttr, declareReactiveAttrs};

import {beingMounted} from './mechanics.js';


class RvAttr {
  value;
  definedBy;
  accessedBy = new Set;

  setValue(value, setBy) {
    this.value = value;
    this.setBy = setBy;
  }
}


function declareReactiveAttrs(proto, names) {
  for (let name of names) {
    if (Object.hasOwn(proto, name)) {
      throw new Error(`Property '${name}' is already present`);
    }
  }

  for (let name of names) {
    defAttrProp(proto, name);
  }
}


function defAttrProp(proto, prop) {
  let store = '_' + prop;

  Object.defineProperty(proto, prop, {
    configurable: true,
    enumerable: false,
    get() {
      let attr = this[store];
      if (attr == null) {
        throw new NoAttrExc;
      }

      if (!beingMounted.deps.has(attr)) {
        beingMounted.deps.add(attr);
        attr.revdeps.add(beingMounted);
      }

      return attr.value;
    },
    set(value) {
      let attr = this[store];

      if (attr != null) {
        invalidateNodes(attr.revdeps);

        attr.originator.attrs.delete(attr);
      }
      else {
        attr = this[store] = new RvAttr();
      }

      attr.setValue(value, beingMounted);
      beingMounted.attrs.add(attr);
    }
  });
}


class NoAttrExc extends Error {

}


function invalidateNodes(nodes) {

}
