export const Result = {
  unevaluated: {
    isNormal: false,
    access() {
      throw new Error(`Accessed unevaluated computation result`);
    }
  },

  plain(value) {
    return {
      __proto__: protoPlain,
      value: value
    }
  },

  exception(exc) {
    return {
      __proto__: protoException,
      exc: exc
    }
  }
};


const protoPlain = {
  isNormal: true,

  access() {
    return this.value;
  }
};


const protoException = {
  isNormal: false,

  access() {
    throw this.exc;
  }
};


