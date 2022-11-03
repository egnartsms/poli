common
   settify
-----

uniquesDups ::=
   function (...Xs) {
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


hasAny ::=
   function (set, X) {
      for (let x of X) {
         if (set.has(x)) {
            return true;
         }
      }

      return false;
   }


deleteIntersection ::=
   :Works with Maps and Sets, in all combinations
   function (sm1, sm2) {
      // any of the 4 combinations of set and map are possible
      let [G, L] = $.greaterLesser(sm1, sm2);

      for (let x of L.keys()) {
         if (G.has(x)) {
            G.delete(x);
            L.delete(x);
         }
      }
   }


greaterLesser ::=
   function (s1, s2) {
      return s1.size > s2.size ? [s1, s2] : [s2, s1];
   }


setDefault ::=
   function (map, key, fnCreate) {
      let value = map.get(key);

      if (value === undefined) {
         value = fnCreate();
         map.set(key, value);
      }
      
      return value;
   }


deleteAll ::=
   function (sm, xs) {
      for (let x of xs) {
         sm.delete(x);
      }
   }

addAll ::=
   function (set, xs) {
      for (let x of xs) {
         set.add(x);
      }
   }

setAll ::=
   function (map, entries) {
      for (let [k, v] of entries) {
         map.set(k, v);
      }
   }

intersect ::=
   function (S, Si) {
      Si = $.settify(Si);
      
      for (let s of S) {
         if (!Si.has(s)) {
            S.delete(s);
         }
      }
   }

purgeSet ::=
   function (S, pred) {
      for (let s of S) {
         if (!pred(s)) {
            S.delete(s);
         }
      }
   }

intersection ::=
   function (...Xs) {
      if (Xs.length === 0) {
         return new Set;
      }

      if (Xs.length === 1) {
         return Xs[0];
      }

      let S = new Set(Xs[0]);

      for (let i = 1; i < Xs.length; i += 1) {
         $.intersect(S, Xs[i]);
      }

      return S;
   }

difference ::=
   function (X, Y) {
      let R = new Set(X);

      for (let y of Y) {
         R.delete(y);
      }

      return R;
   }

union ::=
   function (...Xs) {
      if (Xs.length === 0) {
         return new Set;
      }

      if (Xs.length === 1) {
         return Xs[0];
      }

      let S = new Set(Xs[0]);

      for (let i = 1; i < Xs.length; i += 1) {
         $.addAll(S, Xs[i]);
      }

      return S;
   }
