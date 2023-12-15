import { Queue } from '$/common/queue.js';

export { toFulfill, registerPostFixpointCallback, fulfillToFixpoint };


const toFulfill = new Queue;

const postFixpointCallbacks = [];


function registerPostFixpointCallback(callback) {
   postFixpointCallbacks.push(callback);
}


function fulfillToFixpoint() {
   while (!toFulfill.isEmpty) {
      let item = toFulfill.dequeue();

      item.fulfill();
   }

   for (let callback of postFixpointCallbacks) {
      callback();
   }
}
