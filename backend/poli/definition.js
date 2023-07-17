export {
  Definition, EvaluationOrder
};

import {assert, call} from '$/poli/common.js';
import {Result} from '$/poli/result.js';
import {Root} from '$/poli/reactive';


const EvaluationOrder = {
  UNDEFINED: -1,
  INFIMUM: 0,
  NORMAL_START: 1.0,
  MULT_DOWN: 1 - Number.EPSILON * 2 ** 40,
  MULT_UP: 1 + Number.EPSILON * 2 ** 40,
};


class Definition {
  constructor(module, props) {
    this.module = module;
    this.codeBlock = null;

    this.target = props.target;
    this.factory = props.factory;
    this.referencedBindings = props.referencedBindings;

    this.evaluationOrder = new Root(EvaluationOrder.UNDEFINED);
    this.usedBindings = null;
    this.usedBrokenBinding = null;
    this.result = null;

    for (let ref of this.referencedBindings) {
      ref.referenceBy(this);
    }

    this.module.defs.add(this);
    this.module.unevaluatedDefs.add(this);

    this.setEvaluationResult(Result.unevaluated);
  }

  get isEvaluated() {
    return this.result !== Result.unevaluated;
  }

  makeEvaluated(result, usedBindings, usedBrokenBinding) {
    for (let binding of usedBindings) {
      binding.useBy(this);
    }

    this.usedBindings = usedBindings;
    this.usedBrokenBinding = usedBrokenBinding;

    this.module.unevaluatedDefs.delete(this);
    this.setEvaluationResult(result);
  }

  makeUnevaluated() {
    assert(() => this.isEvaluated);

    for (let binding of this.usedBindings) {
      binding.unuseBy(this);
    }

    this.usedBindings = null;
    this.usedBrokenBinding = null;

    this.module.unevaluatedDefs.add(this);
    this.setEvaluationResult(Result.unevaluated);
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

  /**
   * Remove from its module.
   */
  unlink() {
    this.target.unsetBy(this);

    if (this.usedBindings !== null) {
      for (let binding of this.usedBindings) {
        binding.unuseBy(this);
      }
    }

    this.usedBindings = null;
    this.usedBrokenBinding = null;

    for (let binding of this.referencedBindings) {
      binding.unreferenceBy(this);
    }

    this.referencedBindings.clear();

    this.module.unevaluatedDefs.delete(this);
    this.module.defs.delete(this);
  }

  static stoppedOnBrokenBinding(binding) {
    return {
      __proto__: protoStoppedOnBrokenBinding,
      brokenBinding: binding
    }
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
