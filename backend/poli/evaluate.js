export {
  evaluateNeededDefs
}


import {map} from '$/poli/common.js';
import {Definition} from '$/poli/definition.js';
import {Result} from '$/poli/result.js';
import {derived, mountEffect} from '$/poli/reactive.js';
import {proto$} from '$/poli/module.js';


function evaluateNeededDefs(module) {
  for (let def of module.unevaluatedDefs) {
    mountEffect(() => evaluate(def));
  }
}


function evaluate(def) {
  let usedBindings = new Set;
  let usedBrokenBinding = null;
  let result;

  try {
    result = withNonLocalRefsIntercepted(
      (module, prop) => {
        let binding = module.getBinding(prop);

        usedBindings.add(binding);

        if (binding.isBroken ||
            derived(() =>
              binding.introDef.evaluationOrder.v > def.evaluationOrder.v)) {
          if (usedBrokenBinding === null) {
            // There may be a case when we had already attempted to stop the
            // evaluation but it caught our exception and continued on. This
            // is an incorrect behavior that we have no control over.
            usedBrokenBinding = binding;
          }

          throw new StopOnBrokenBinding;
        }

        return binding.value;
      },
      () => Result.plain(def.factory.call(null, def.module.$))
    );
  }
  catch (e) {
    if (e instanceof StopOnBrokenBinding) {
      result = Definition.stoppedOnBrokenBinding(usedBrokenBinding);
    }
    else {
      result = Result.exception(e);
    }
  }

  def.makeEvaluated(result, usedBindings, usedBrokenBinding);

  return () => def.makeUnevaluated();
}


class StopOnBrokenBinding extends Error {}


function withNonLocalRefsIntercepted(handler, body) {
  let oldV = Object.getOwnPropertyDescriptor(proto$, 'v');

  let module2proxy = new Map;

  Object.defineProperty(proto$, 'v', {
    configurable: true,
    get: function () {
      let proxy = module2proxy.get(this.module);

      if (proxy === undefined) {
        proxy = new Proxy(this.module.ns, {
          get: (target, prop, receiver) => handler(this.module, prop)
        });

        module2proxy.set(this.module, proxy);
      }

      return proxy;
    }
  });

  try {
    return body();
  }
  finally {
    Object.defineProperty(proto$, 'v', oldV);
  }
}
