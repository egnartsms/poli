export function check(condition, message=`Logic error`) {
   if (!condition) {
      throw new Error(message);
   }
}


export function* map(xs, func) {
  for (let x of xs) {
    yield func(x);
  }
}


export function addAll(container, xs) {
  for (let x of xs) {
    container.add(x);
  }
}


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
