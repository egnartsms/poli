export {
  Binding, dirtyBindings
}


import {
  Computed, Leaf, VirtualLeaf, invalidate, derived
} from '$/poli/reactive.js';


let dirtyBindings = new Set;


class Binding {
  constructor(module, name) {
    this.module = module;
    this.name = name;
    this.defs = new Map;  // def -> Leaf(value-set-by-definition)
    this.defsize = new VirtualLeaf(() => this.defs.size);
    this.refs = new Set;
    this.usages = new Set;

    this.value = new Computed(() => bindingValue(this));

    this.value.addHook({
      // onComputed: () => {
      //   dirtyBindings.delete(this);
      // },
      onInvalidated: () => {
        for (let def of this.usages) {
          def.makeUnevaluated();
        }
        // dirtyBindings.add(this);
      }
    });
  }

  recordValueInNamespace() {
    Object.defineProperty(this.module.ns, this.name, {
      configurable: true,
      enumerable: true,
      ...makeBindingValueDescriptor(this)
    });
  }

  access({normal, broken}) {
    if (this.value.v.isBroken) {
      return broken();
    }
    else {
      return normal(this.value.v.value);
    }
  }

  setBrokenBy(def) {
    let cell = cellForDef(this, def);

    cell.v = Binding.Value.broken;
  }

  setBy(def, value) {
    let cell = cellForDef(this, def);

    cell.v = Binding.Value.plain(value);
  }

  referenceBy(def) {
    this.refs.add(def);
  }

  useBy(def) {
    this.usages.add(def);
  }

  unuseBy(def) {
    this.usages.delete(def);
  }
}


function cellForDef(binding, def) {
  let cell = binding.defs.get(def);

  if (!cell) {
    cell = new Leaf;
    binding.defs.set(def, cell);
    invalidate(binding.defsize);
  }

  return cell;
}


function bindingValue(binding) {
  if (derived(() => binding.defsize.v === 0)) {
    return Binding.Value.undefined;
  }

  if (derived(() => binding.defsize.v > 1)) {
    return Binding.Value.duplicated;
  }

  let [cell] = binding.defs.values();

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
  if (binding.value.v.isBroken) {
    return {
      get() {
        throw new Error(`Broken binding access: '${binding.name}'`);
      }
    }
  }
  else {
    return {
      value: binding.value.v.value,
      writable: false
    }    
  }
}
