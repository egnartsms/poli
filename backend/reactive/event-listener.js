import { mountingContext } from './node.js';

export { externalEventHandler };


function externalEventHandler(object, event, listener) {
   object.addEventListener(event, listener);

   mountingContext.originator.addEffect({
      undo: () => object.removeEventListener(event, listener)
   });
}
