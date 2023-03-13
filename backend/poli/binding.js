export {
  Binding
}


class Binding {
  constructor(module, name) {
    this.module = module;
    this.name = name;
    this.defs = new Map;
    this.refs = new Set;
    this.usages = new Set;

    this.value = {
      kind: 'unevaluated'
    }
  }

  setBy(def, value) {
    this.defs.set(def, value);
  }

  referenceBy(def) {
    this.refs.add(def);
  }

  useBy(def) {
    this.usages.add(def);
  }

  // get value() {
  //   if (this.defs.length === 0) {
  //     return 'unknown';
  //   }

  //   if (this.defs.length > 1) {
  //     return 'duplicate';
  //   }

  //   let [entry] = this.defs;
  // }
}


function bindingValue(binding) {
  let {defs} = binding;

  if (defs.size === 0) {
    return {
      isDefined: false,
      reason: 'undefined'
    }
  }

  if (defs.size > 1) {
    return {
      isDefined: false,
      reason: 'overdefined'
    }
  }

  let [def] = defs;

  if (def.exc !== null) {
    return {
      isDefined: false,
      reason: 'unset'
    }
  }
}
