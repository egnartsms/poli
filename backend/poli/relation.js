bootstrap
   assert
trie
   * as: trie
-----
Relation ::= function (indices) {
   let spec = Object.fromEntries(function* () {
      for (let {name, unique, prop, props} of indices) {
         if (prop !== undefined) {
            if (props !== undefined) {
               throw new Error(`Cannot specify both 'prop' and 'props' in a Relation index`);
            }
            props = [prop];
         }

         yield [name, {unique, props}];
      }
   }());

   let tries = Object.fromEntries(function* () {
      for (let [name, {unique, props}] of Object.entries(spec)) {
         function compare(key, item) {
            // For non-unique indices, 'item' will actually be an array of facts
            let fact = unique ? item : item[0];

            for (let prop of props) {
               if (key < fact[prop]) {
                  return -1;
               }
               if (key > fact[prop]) {
                  return 1;
               }
            }

            return 0;
         }

         yield [name, $.Trie(compare)];
      }
   }());

   return {
      spec,
      tries,
   }
}
addFact ::= function (rel, fact) {
   // Add fact to all the indexes
   let newTries = Object.fromEntries(function* () {
      
   }())
}
