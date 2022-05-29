common
   all
   assert
   map
   trackingFinal
   commonArrayPrefixLength
   hasOwnDefinedProperty
   hasOwnProperty
-----
unique ::= 1

indexFromSpec ::=
   function (spec) {
      let index;

      if (spec[spec.length - 1] === $.unique) {
         index = spec.slice(0, -1);
         index.isUnique = true;
      }
      else {
         index = spec.slice();
         index.isUnique = false;
      }

      return index;
   }

superIndexOfAnother ::=
   function (index1, index2) {
      let len = $.commonArrayPrefixLength(index1, index2);
      if (len === index2.length) {
         return index1;
      }
      else if (len === index1.length) {
         return index2;
      }
      else {
         return null;
      }
   }

copyIndex ::=
   function (index) {
      return Object.assign(Array.from(index), {isUnique: index.isUnique});
   }

reduceIndex ::=
   function (index, weedOut) {
      return Object.assign(index.filter(attr => !weedOut(attr)), {
         isUnique: index.isUnique
      })
   }

isFullyCoveredBy ::=
   function (index, boundAttrs) {
      return $.all(index, attr => boundAttrs.includes(attr));
   }

Fitness ::=
   ({
      minimum: -100,  // unless we have that large indices (we don't)
      hit: 0,         // this must be 0 because of the way we computeFitness()
      uniqueHit: 1,
   })

indexFitnessByBindings ::=
   function (index, bindings) {
      return $.indexFitnessByBounds(
         index,
         Array.from(index, a => $.hasOwnProperty(bindings, a))
      );
   }

indexFitnessByBounds ::=
   function (index, bounds) {
      let lim = Math.min(index.length, bounds.length);
      let i = 0;

      while (i < lim && bounds[i]) {
         i += 1;
      }

      if (i === 0) {
         return $.Fitness.minimum;
      }

      let diff = i - index.length;

      return (diff === 0 && index.isUnique) ? $.Fitness.uniqueHit : diff;
   }

isUniqueHitByBindings ::=
   function (index, bindings) {
      return $.indexFitnessByBindings(index, bindings) === $.Fitness.uniqueHit;
   }

indexKeys ::=
   function (index, bindings) {
      let keys = [];

      for (let attr of index) {
         if (!$.hasOwnProperty(bindings, attr)) {
            break;
         }

         keys.push(bindings[attr]);
      }

      return keys;
   }
