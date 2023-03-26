export {
  Module
}


import {assert} from '$/poli/common.js';
import {Binding} from './binding.js';
import {common$} from '$/poli/evaluate.js';



class Module {
  constructor(path) {
    this.path = path;
    this.bindings = new Map;
    this.defs = [];
    this.unevaluatedDefs = [];
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

  addDefinition(def) {
    assert(() => !def.isEvaluated);

    this.defs.push(def);
    this.recordAsUnevaluated(def);
  }

  recordAsUnevaluated(def) {
    this.unevaluatedDefs.push(def);
  }
}
