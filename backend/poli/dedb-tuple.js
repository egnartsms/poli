-----
"Tuple" means logical index: an array of columns that constitute an index. "Index" means
the actual data structure containing records/entities.

unique ::= 1

tupleFromSpec ::=
   function (spec) {
      let tuple;

      if (spec.at(-1) === $.unique) {
         tuple = spec.slice(0, -1);
         tuple.isUnique = true;
      }
      else {
         tuple = spec.slice();
         tuple.isUnique = false;
      }

      tuple.isNoMatchFine = false;
      tuple.key = `(${tuple.join(',')})`;

      return tuple;
   }


reduceTuple ::=
   function (tuple, boundFn) {
      let reduced = tuple.filter(attr => !boundFn(attr));

      reduced.isUnique = tuple.isUnique;
      reduced.isNoMatchFine = tuple.isNoMatchFine || tuple.length > 0 && boundFn(tuple[0]);
      reduced.key = `(${reduced.join(',')})`;
      
      return reduced;
   }


Fitness ::=
   ({
      minimum: -100,  // unless we have that large indices (we don't)
      hit: 0,         // this must be 0 because of the way we computeFitness()
      uniqueHit: 1,   // unique index (full) hit
      entityHit: 2,   // when entity variable is bound, so the entity is directly known
   })


tupleFitnessByBindings ::=
   function (tuple, bindings) {
      return $.tupleFitness(
         tuple,
         Array.from(tuple, a => Object.hasOwn(bindings, a))
      );
   }


tupleFitness ::=
   function (tuple, bounds) {
      let lim = Math.min(tuple.length, bounds.length);
      let i = 0;

      while (i < lim && bounds[i]) {
         i += 1;
      }

      let diff = i - tuple.length;

      if (i === 0) {
         return tuple.isNoMatchFine ? diff : $.Fitness.minimum;
      }
      else {
         return (diff === 0 && tuple.isUnique) ? $.Fitness.uniqueHit : diff;
      }
   }


isUniqueHitByBindings ::=
   function (index, bindings) {
      return $.tupleFitnessByBindings(index, bindings) === $.Fitness.uniqueHit;
   }


tupleKeys ::=
   function (tuple, bindings) {
      let keys = [];

      for (let attr of tuple) {
         if (!Object.hasOwn(bindings, attr)) {
            break;
         }

         keys.push(bindings[attr]);
      }

      return keys;
   }
