import { activeContext } from './mount.js';

export { externalEventHandler };


function externalEventHandler(object, event, listener) {
   object.addEventListener(event, listener);

   activeContext().originator.addEffect({
      undo: () => object.removeEventListener(event, listener)
   });
}
