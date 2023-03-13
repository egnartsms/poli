export {
  Module
}


import {Binding} from './binding.js';
import {Definition} from './definition.js';
import {common$} from '$/poli/evaluate.js';


class Module {
  constructor(path) {
    this.path = path;
    this.bindings = new Map;
    this.defs = [];
    this.ns = Object.create(null);
    // This object is passed as '_$' to all definitions of this module. That's
    // how definitions reference non-local identifiers: 'x' becomes '_$.v.x'.
    this.$ = {
      __proto__: common$,
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
