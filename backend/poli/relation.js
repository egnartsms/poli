bootstrap
   assert
   hasOwnProperty
common
   compareValues
trie
   * as: trie
-----
Relation ::= function () {
   return {};
}
Index ::= function (item2key) {
   let trie = $.trie.Trie((key, item) => $.compareValues(key, item2key(item)));
   trie.item2key = item2key;

   return trie;
}
addItem ::= function (indexed, item) {
   return $.trie.addItem(indexed, item, indexed.item2key(item));
}
deleteByKey ::= function (indexed, key) {
   return $.trie.deleteByKey(indexed, key);
}
addUniqueGrouping ::= function (rel, name, fact2key) {
   $.assert(!$.hasOwnProperty(rel, name));

   rel[name] = $.Index(fact2key);
}
addFact ::= function (rel, fact) {
   // Add fact to all the groupings
   for (let index of Object.values(rel)) {
      let wasNew = $.addItem(index, fact);

      if (!wasNew) {
         throw new Error(`Not implemented: adding facts that break unique groupings`);
      }
   }
}


Relation2 ::= function (indices) {
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
