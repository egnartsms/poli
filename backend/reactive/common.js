export { warnOnError };


function warnOnError(thunk) {
   return () => {
      try {
         thunk();
      }
      catch (exc) {
         console.warn("Reactive node threw an unhandled exception:", exc);
      }
   };
}
