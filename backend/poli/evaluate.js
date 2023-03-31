export {
  common$,
  ensureAllDefinitionsEvaluated
}


import {map} from '$/poli/common.js';
import {Definition} from '$/poli/definition.js';
import {Result} from '$/poli/eval.js';


function ensureAllDefinitionsEvaluated(module) {
  for (let def of module.unevaluatedDefs) {
    evaluate(def);
  }

  module.unevaluatedDefs.length = 0;
}


function evaluate(def) {
  let brokenBinding = null;
  let result;

  try {
    result = withNonLocalRefsIntercepted(
      (module, prop) => {
        let binding = module.getBinding(prop);

        def.use(binding);

        if (binding.isBroken ||
            binding.introDef.evaluationOrder > def.evaluationOrder) {
          if (brokenBinding === null) {
            // This means we had already attempted to stop the evaluation but
            // it caught our exception and continued on. This is incorrect
            // behavior that we unfortunately have no means to eschew.
            brokenBinding = binding;
          }

          throw new StopOnBrokenBinding;          
        }
        else {
          return binding.value;
        }
      },
      () => Result.plain(def.factory.call(null, def.module.$))
    );
  }
  catch (e) {
    if (e instanceof StopOnBrokenBinding) {
      result = Definition.stoppedOnBrokenBinding(brokenBinding);
    }
    else {
      result = Result.exception(e);
    }
  }

  def.setEvaluationResult(result);
}


const common$ = {
  get v() {
    return this.module.ns;
  }
};


function withNonLocalRefsIntercepted(handler, callback) {
  let oldV = Object.getOwnPropertyDescriptor(common$, 'v');

  let module2proxy = new Map;

  Object.defineProperty(common$, 'v', {
    configurable: true,
    get: function () {
      let proxy = module2proxy.get(this.module);

      if (proxy === undefined) {
        proxy = new Proxy(this.module.ns, {
          get: (target, prop, receiver) => {
            return handler(this.module, prop);
          }
        });

        module2proxy.set(this.module, proxy);
      }

      return proxy;
    }
  });

  try {
    return callback();
  }
  finally {
    Object.defineProperty(common$, 'v', oldV);
  }
}


class StopOnBrokenBinding extends Error {}
