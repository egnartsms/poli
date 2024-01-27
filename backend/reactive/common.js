export const symExcNormal = Symbol.for('poli.exc-normal');


export function warnOnError(thunk, errorHandler) {
   return () => {
      try {
         thunk();
      }
      catch (exc) {
         if (exc[symExcNormal] !== true) {
            console.warn("Reactive node threw an unhandled exception:", exc);
            errorHandler && errorHandler(exc);
         }
      }
   };
}
