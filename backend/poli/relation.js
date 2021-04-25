common
   assert
   hasOwnProperty
   lessThan
   newObj
trie
   * as: trie
-----
proto ::= ({})
Relation ::= function ({pk, uniques, facts=null}) {
   let rel = $.newObj($.proto, {pk, uniques});
   
   for (let [name, prop] of Object.entries(uniques)) {
      $.assert(!$.hasOwnProperty(rel, name));

      rel[name] = $.trie.Trie({
         keyof: fact => fact[prop],
         less: $.lessThan
      });
   }

   if (facts !== null) {
      $.addFacts(rel, facts);
      $.freeze(rel);
   }

   return rel;
}
newIdentity ::= function (rel) {
   let xrel = $.newObj($.proto, {
      pk: rel.pk,
      uniques: rel.uniques
   });

   for (let name of Object.keys(rel.uniques)) {
      xrel[name] = $.trie.newIdentity(rel[name]);
   }

   return xrel;
}
freeze ::= function (rel) {
   for (let name of Object.keys(rel.uniques)) {
      $.trie.freeze(rel[name]);
   }
}
facts ::= function (rel) {
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
      let didRemove = $.trie.remove(rel[name], fact);
      $.assert(didRemove);
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