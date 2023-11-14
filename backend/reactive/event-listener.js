import { check } from '$/common/util.js';
import { runningNode } from './node.js';

export { externalEventHandler };


function externalEventHandler(object, event, listener) {
   object.addEventListener(event, listener);
   runningNode.undo.push(() => object.removeEventListener(event, listener));
}
