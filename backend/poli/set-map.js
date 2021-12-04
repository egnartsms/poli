-----
uniquesDups ::= function (...Xs) {
   let uniques = new Set;
   let duplicated = new Set;

   for (let X of Xs) {
      for (let x of X) {
         if (duplicated.has(x))
            ;
         else if (uniques.has(x)) {
            uniques.delete(x);
            duplicated.add(x);
         }
         else {
            uniques.add(x);
         }
      }
   }

   return [uniques, duplicated];
}
subtract ::= function (set, X) {
   for (let x of X) {
      set.delete(x);
   }
}
add ::= function (set, X) {
   for (let x of X) {
      set.add(x);
   }
}
intersectionRest ::= function (X0, ...Xs) {
   let setA = new Set(X0);
   let setB = new Set;
   let rest = new Set;

   for (let X of Xs) {
      for (let x of X) {
         if (setA.has(x)) {
            setB.add(x);
         }
         else {
            rest.add(x);
         }
      }

      setA.clear();
      [setA, setB] = [setB, setA];
   }

   return [setA, rest];
}
hasAny ::= function (set, X) {
   for (let x of X) {
      if (set.has(x)) {
         return true;
      }
   }

   return false;
}
deleteIntersection ::= function (sm1, sm2) {
   // any of the 4 combinations of set and map are possible
   let [G, L] = $.greaterLesser(sm1, sm2);

   for (let x of L.keys()) {
      if (G.has(x)) {
         G.delete(x);
         L.delete(x);
      }
   }
}
greaterLesser ::= function (s1, s2) {
   return s1.size > s2.size ? [s1, s2] : [s2, s1];
}
deleteAll ::= function (sm, xs) {
   for (let x of xs) {
      sm.delete(x);
   }
}
addAll ::= function (set, xs) {
   for (let x of xs) {
      set.add(x);
   }
}
setAll ::= function (map, entries) {
   for (let [k, v] of entries) {
      map.set(k, v);
   }
}
