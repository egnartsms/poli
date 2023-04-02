export {
  Module, proto$
}


import {assert} from '$/poli/common.js';
import {Binding} from './binding.js';


/**
 * Common prototype of all the '_$' module-specific objects.
 * 
 * This trick is used to easily intercept access of non-local
 * (module-level) identifiers in all the modules of the system. Those '_$'
 * objects for each module are expected to have the 'module' property that
 * points back to respective Module instance. In each module, the 'name'
 * references to non-local variables become '_$.v.name'.
 */
const proto$ = {
  get v() {
    return this.module.ns;
  }
};


class Module {
  constructor(path) {
    this.path = path;
    this.bindings = new Map;
    this.dirtyBindings = new Set;
    this.defs = [];
    this.unevaluatedDefs = new Set;
    this.ns = Object.create(null);
    // This object is passed as '_$' to all definitions of this module.
    this.$ = {
      __proto__: proto$,
      module: this
    };
  }

  getBinding(name) {
    let binding = this.bindings.get(name);

    if (binding === undefined) {
      binding = new Binding(this, name);
      this.bindings.set(name, binding);
    }

    return binding;
  }
}
