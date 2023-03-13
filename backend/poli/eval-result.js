export const EvaluationResult = {
  unevaluated: {
    isNormal: false
  },

  plain(value) {
    return {
      isNormal: true,
      value: value
    }
  },

  exception(exc) {
    return {
      isNormal: false,
      exc: exc
    }
  },

  stoppedOnBrokenBinding(binding) {
    return {
      isNormal: false,
      brokenBinding: binding
    }
  }
};
