import {Result} from '$/poli/eval.js';


export class Definition {
  static stoppedOnBrokenBinding(binding) {
    return {
      __proto__: protoStoppedOnBrokenBinding,
      brokenBinding: binding
    }
  }

  constructor(module, props) {
    this.module = module;

    this.target = props.target;
    this.source = props.source;
    this.evaluatableSource = props.evaluatableSource;
    this.factory = props.factory;
    this.referencedBindings = props.referencedBindings;

    this.usedBindings = new Set;
    this.usedBrokenBinding = null;

    this.result = null;

    for (let ref of this.referencedBindings) {
      ref.referenceBy(this);
    }

    this.setEvaluationResult(Result.unevaluated);
  }

  use(binding) {
    this.usedBindings.add(binding);
    binding.useBy(this);

    if (binding.isBroken) {
      this.usedBrokenBinding = binding;
    }
  }

  setEvaluationResult(result) {
    this.result = result;

    if (result.isNormal) {
      this.target.setBy(this, result.value);
    }
    else {
      this.target.setBrokenBy(this);
    }
  }

  makeUnevaluated() {
    if (this.isUnevaluated) {
      return;
    }

    for (let binding of this.usedBindings) {
      binding.unuseBy(this);
    }

    this.usedBindings.clear();
    this.usedBrokenBinding = null;

    this.setEvaluationResult(Result.unevaluated);
    this.module.recordAsUnevaluated(this);
  }

  get isUnevaluated() {
    return this.result === Result.unevaluated;
  }
}


const protoStoppedOnBrokenBinding = {
  isNormal: false,

  access() {
    throw new Error(
      `Definition accessed broken binding: '${this.brokenBinding.name}'`
    );
  }
};
