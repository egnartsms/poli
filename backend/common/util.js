export function check(condition, message=`Logic error`) {
   if (!condition) {
      throw new Error(message);
   }
}
