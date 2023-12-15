/**
 * Top-level nodes or iteration-based nodes are mounted (their procedures are called).
 * For nodes, the operation of fulfillment is the same as mounting.
 */

export {
   activeContext,
   registerMountingMiddleware,
   doMounting,
};


const mountingStack = [];


function activeContext() {
   return mountingStack.at(-1);
}


let topMiddleware = null;


function registerMountingMiddleware(wrapper) {
   topMiddleware = {
      wrapper: wrapper,
      next: topMiddleware
   };
}


function doMounting(context, body) {
   function call(middleware) {
      if (middleware === null) {
         mountingStack.push(context);
         body();
         mountingStack.pop();
      }
      else {
         let {wrapper, next} = middleware;

         wrapper.call(null, context, () => call(next));
      }
   }

   call(topMiddleware);
}
