common
   assert
   hasOwnProperty
   lessThan
trie
   * as: trie
-----
Relation ::= function (pk, uniques, groupings) {
   let rel = {
      uniques: Object.fromEntries(function* () {
         for (let {name, prop} of uniques) {
            yield [name, {prop}];
         }
      }()),
      pk: pk
   };

   for (let {name, prop} of uniques) {
      $.assert(!$.hasOwnProperty(rel, name));

      rel[name] = $.trie.Trie({
         keyof: fact => fact[prop],
         less: $.lessThan
      });
   }

   return rel;
}
asMutable ::= function (rel) {
   let newRel = {...rel};

   for (let name of Object.keys(newRel.uniques)) {
      newRel[name] = $.trie.asMutable(newRel[name]);
   }

   return newRel;
}
addFacts ::= function (rel, facts) {
   // Add facts to all the unique indices
   for (let fact of facts) {
      for (let name of Object.keys(rel.uniques)) {
         let wasNew = $.trie.add(rel[name], fact);
         
         if (!wasNew) {
            throw new Error(`Attempt to add a fact that breaks unique index(es)`);
         }
      }
   }
}
freeze ::= function (rel) {
   for (let name of Object.keys(rel.uniques)) {
      $.trie.freeze(rel[name]);
   }
}
