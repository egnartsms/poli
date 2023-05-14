export {
  Binding, abandonedBindings, touchedBindings
}


import {assert} from '$/poli/common.js';
import {methodFor, propertyFor} from '$/poli/common/generic.js';
import {
  Root, VirtualRoot, submemo, ReactiveSet, Filterer, StabilityTracker,
  reactivePropertyFor,
} from '$/poli/reactive';


let allBindings = new ReactiveSet;


function Binding(module, name) {
  this.module = module;
  this.name = name;
  this.defs = [];  // [[def, Root(value-set-by-definition)], ...]
  this.Ndefs = new VirtualRoot(() => this.defs.length);
  this.refs = new Set;
  this.Nrefs = new VirtualRoot(() => this.refs.size);
  this.usages = new Set;

  allBindings.add(this);
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
};


function plainValue(value) {
  return {
    isBroken: false,
    value: value
  }
}


methodFor(Binding, function flush() {
  Object.defineProperty(this.module.ns, this.name, {
    configurable: true,
    enumerable: true,
    ...makeDescriptor(this)
  });
});


function makeDescriptor(binding) {
  if (binding.isBroken) {
    return {
      get() {
        throw new Error(`Broken binding access: '${binding.name}'`);
      }
    }
  }
  else {
    return {
      value: binding.value.value,
      writable: false
    }    
  }
}


reactivePropertyFor(Binding, function value() {
  if (submemo(() => this.Ndefs.v === 0)) {
    return Binding.Value.undefined;
  }

  if (submemo(() => this.Ndefs.v > 1)) {
    return Binding.Value.duplicated;
  }

  let [[, cell]] = this.defs;

  return cell.v;
});


reactivePropertyFor(Binding, function isBroken() {
  return this.value.isBroken;
});


propertyFor(Binding, function introDef() {
  if (this.defs.length !== 1) {
    throw new Error;
  }

  let [[def]] = this.defs;

  return def;
});


methodFor(Binding, function setBrokenBy(def) {
  let cell = cellForDef(this, def);

  cell.v = Binding.Value.broken;
});


methodFor(Binding, function setBy(def, value) {
  let cell = cellForDef(this, def);

  cell.v = plainValue(value);
});


function cellForDef(binding, def) {
  let cell = binding.defs.find(([xdef]) => xdef === def)?.[1];

  if (cell === undefined) {
    cell = new Root;
    binding.defs.push([def, cell]);
    binding.Ndefs.invalidate();
  }

  return cell;
}


methodFor(Binding, function unsetBy(def) {
  let i = this.defs.findIndex(([xdef]) => xdef === def);

  if (i === -1) {
    throw new Error;
  }

  this.defs.splice(i, 1);
  this.Ndefs.invalidate();
});


methodFor(Binding, function referenceBy(def) {
  this.refs.add(def);
  this.Nrefs.invalidate();
});


methodFor(Binding, function unreferenceBy(def) {
  this.refs.delete(def);
  this.Nrefs.invalidate();
});


methodFor(Binding, function useBy(def) {
  this.usages.add(def);
});


methodFor(Binding, function unuseBy(def) {
  this.usages.delete(def);
});


reactivePropertyFor(Binding, function isAbandoned() {
  return (
    submemo(() => this.Ndefs.v === 0) &&
    submemo(() => this.Nrefs.v === 0)
  )

  // return submemo(() => this.Ndefs.v === 0 && this.Nrefs.v === 0);

  // return this.Ndefs.v === 0 && this.Nrefs.v === 0;
});


let abandonedBindings = new Filterer(
  allBindings, binding => binding.isAbandoned
);


let touchedBindings = new StabilityTracker(
  allBindings, binding => binding.value
);


methodFor(Binding, function unlink() {
  allBindings.remove(this);
  this.module.unlinkBinding(this);
  delete this.module.ns[this.name];
});
