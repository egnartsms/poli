export {mountEffect};

import {methodFor, specialize} from '$/poli/common/generic.js';
import {free, onDepInvalidated, trackingDepsOf, unlinkFromDeps} from './mechanics.js';


class Effect {
  deps = new Set;
  undo = null;
}


specialize(onDepInvalidated, Effect, function (effect, dep) {
  unlinkFromDeps(effect);
  effect.undo();

  return false;
});


function mountEffect(fnBody) {
  let effect = new Effect;

  try {
    effect.undo = trackingDepsOf(effect, fnBody;
  }
  catch (e) {
    unlinkFromDeps(effect);
    throw e;
  }

  return effect;
}


methodFor(Effect, function cancel() {
  unlinkFromDeps(this);
});
