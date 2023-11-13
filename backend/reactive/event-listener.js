import { check } from '$/common/util.js';
import { runningNode, callAsMounting, runToFixpoint } from './node.js';

export { addEventListener };


function addEventListener(object, event, handler) {
   let capturedNode = runningNode;

   let wrappedHandler = (...args) => {
      let ret = callAsMounting(capturedNode, () => handler(...args));

      runToFixpoint();

      return ret;
   };

   object.addEventListener(event, wrappedHandler);

   runningNode.undo.push(() => object.removeEventListener(event, wrappedHandler));
}
