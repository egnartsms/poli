export function arrayify(object) {
   return object instanceof Array ? object : [object];
}


export function mergeSetsIntoBigger(setA, setB) {
   let [smaller, bigger] = setA.size < setB.size ? [setA, setB] : [setB, setA];

   for (let x of smaller) {
      bigger.add(x);
   }

   return bigger;
}
