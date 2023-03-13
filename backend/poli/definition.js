export {
  Definition
}


class Definition {
  constructor(module, props) {
    this.module = module;

    this.target = props.target;
    this.source = props.source;
    this.evaluatableSource = props.evaluatableSource;
    this.factory = props.factory;
    this.referencedBindings = props.referencedBindings;

    this.usedBindings = new Set;
    this.usedBrokenBinding = null;

    this.value = null;
  }

  use(binding) {
    this.usedBindings.add(binding);
    binding.useBy(this);

    if (binding.isBroken) {
      this.usedBrokenBinding = binding;
    }
  }

  setEvaluationResult(value) {
    this.value = value;
    this.target.setBy(this, value);
  }
}
