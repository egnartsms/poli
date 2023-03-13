export {
  common$,
  ensureAllDefinitionsEvaluated
}


import {Definition} from '$/poli/definition.js';
import {map, methodFor} from '$/poli/common.js';
import {EvaluationResult} from '$/poli/eval-result.js';


function ensureAllDefinitionsEvaluated(module) {
  for (let def of module.defs) {
    ensureEvaluated(def);
  }
}


function ensureEvaluated(def) {
  if (def.value !== EvaluationResult.unevaluated) {
    return;
  }

  let accessedBrokenBinding = null;
  let result;

  try {
    result = withNonLocalRefsIntercepted(
      (module, prop) => {
        if (accessedBrokenBinding) {
          // This means we had already attempted to stop the evaluation but it
          // caught our exception and continued on. This is incorrect behavior
          // that we unfortunately have no means to enforce.
          throw new StopOnBrokenBinding;
        }

        let binding = module.getBinding(prop);

        def.use(binding);

        if (binding.isBroken) {
          accessedBrokenBinding = binding;

          throw new StopOnBrokenBinding;
        }
        else {
          return binding.access();
        }
      },
      () => EvaluationResult.plain(def.factory.call(null, def.module.$))
    );
  }
  catch (e) {
    if (e instanceof StopOnBrokenBinding) {
      result = EvaluationResult.stoppedOnBrokenBinding(accessedBrokenBinding);
    }
    else {
      result = EvaluationResult.exception(e);
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
