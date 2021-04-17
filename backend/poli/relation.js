common
   assert
   hasOwnProperty
   lessThan
trie
   * as: trie
-----
Relation ::= class Relation {
   constructor (pk, uniques, groupings) {
      this.uniques = Object.fromEntries(function* () {
         for (let {name, prop} of uniques) {
            yield [name, {prop}];
         }
      }());
      this.pk = pk;

      for (let {name, prop} of uniques) {
         $.assert(!$.hasOwnProperty(this, name));

         this[name] = $.trie.Trie({
            keyof: fact => fact[prop],
            less: $.lessThan
         });
      }
   }
}
newIdentity ::= function (rel) {
   let newRel = Object.assign(Object.create($.Relation.prototype), rel);

   for (let name of Object.keys(newRel.uniques)) {
      newRel[name] = $.trie.newIdentity(newRel[name]);
   }

   return newRel;
}
freeze ::= function (rel) {
   for (let name of Object.keys(rel.uniques)) {
      $.trie.freeze(rel[name]);
   }
}
genFacts ::= function (rel) {
   return $.trie.items(rel[rel.pk]);
}
addFacts ::= function (rel, facts) {
   // Add facts to all the unique indices
   for (let fact of facts) {
      $.addFact(rel, fact);
   }
}
addFact ::= function (rel, fact) {
   for (let name of Object.keys(rel.uniques)) {
      let wasNew = $.trie.add(rel[name], fact);
      $.assert(wasNew);
   }
}
removeFact ::= function (rel, fact) {
   for (let name of Object.keys(rel.uniques)) {
      let didDelete = $.trie.remove(rel[name], fact);
      $.assert(didDelete);
   }
}
changeFact ::= function (rel, fact, newFact) {
   $.removeFact(rel, fact);
   $.addFact(rel, newFact);
}
updated ::= function (rel, fnMutator) {
   let newRel = $.newIdentity(rel);
   fnMutator(newRel);
   $.freeze(newRel);
   return newRel;
}