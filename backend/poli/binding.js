export {
  Binding
}


import {assert} from '$/poli/common.js';
import {Computed, Leaf, VirtualLeaf, derived} from '$/poli/reactive.js';


class Binding {
  constructor(module, name) {
    this.module = module;
    this.name = name;
    this.defs = [];  // [[def, Leaf(value-set-by-definition)], ...]
    this.deftimes = new VirtualLeaf(() => this.defs.length);
    this.refs = new Set;
    this.usages = new Set;
    this.cell = new Computed(bindingValue.bind(null, this));

    module.dirtyBindings.add(this);
  }

  flush() {
    Object.defineProperty(this.module.ns, this.name, {
      configurable: true,
      enumerable: true,
      ...makeBindingValueDescriptor(this)
    });

    // Previous code should have accessed 'this.cell' so it must be computed
    assert(() => !this.cell.isInvalidated);

    this.module.dirtyBindings.delete(this);
    this.cell.wind(() => this.module.dirtyBindings.add(this));
  }

  get isBroken() {
    return this.cell.v.isBroken;
  }

  get value() {
    return this.cell.v.value;
  }

  get introDef() {
    let [[def]] = this.defs;

    return def;
  }

  setBrokenBy(def) {
    let cell = cellForDef(this, def);

    cell.v = Binding.Value.broken;
  }

  setBy(def, value) {
    let cell = cellForDef(this, def);

    cell.v = Binding.Value.plain(value);
  }

  unsetBy(def) {
    let i = this.defs.findIndex(([defx]) => defx === def);

    if (i === -1) {
      throw new Error(`Logic error`);
    }

    this.defs.splice(i, 1);
    this.deftimes.invalidate();
  }

  referenceBy(def) {
    this.refs.add(def);
  }

  unreferenceBy(def) {
    this.refs.delete(def);
  }

  useBy(def) {
    this.usages.add(def);
  }

  unuseBy(def) {
    this.usages.delete(def);
  }
}


function cellForDef(binding, def) {
  let cell = binding.defs.find(([defx]) => defx === def)?.[1];

  if (cell === undefined) {
    cell = new Leaf;
    binding.defs.push([def, cell]);
    binding.deftimes.invalidate();
  }

  return cell;
}


function bindingValue(binding) {
  if (derived(() => binding.deftimes.v === 0)) {
    return Binding.Value.undefined;
  }

  if (derived(() => binding.deftimes.v > 1)) {
    return Binding.Value.duplicated;
  }

  let [[, cell]] = binding.defs;

  return cell.v;
}


function makeDependentDefinitionsUnevaluated(binding) {
  for (let def of binding.usages) {
    def.makeUnevaluated();
  }
}


Binding.Value = {
  undefined: {
    isBroken: true,
  },
  duplicated: {
    isBroken: true,
  },
  broken: {
    isBroken: true,
  },
  plain(value) {
    return {
      isBroken: false,
      value: value
    }
  }
};


function makeBindingValueDescriptor(binding) {
  if (binding.isBroken) {
    return {
      get() {
        throw new Error(`Broken binding access: '${binding.name}'`);
      }
    }
  }
  else {
    return {
      value: binding.value,
      writable: false
    }    
  }
}
