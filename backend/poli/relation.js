common
   assert
   hasOwnProperty
   lessThan
   newObj
trie
   * as: trie
-----
proto ::= ({
   [Symbol.iterator] () {
      return $.facts(this);
   }
})
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
   }

   return rel;
}
uniques ::= function (rel) {
   return Object.keys(rel.uniques);
}
copy ::= function (rel) {
   let xrel = $.newObj($.proto, {
      pk: rel.pk,
      uniques: rel.uniques
   });

   for (let name of $.uniques(rel)) {
      xrel[name] = $.trie.copy(rel[name]);
   }

   return xrel;
}
update ::= function (rel, fn, ...restArgs) {
   let xrel = $.copy(rel);
   fn(xrel, ...restArgs);
   return xrel;
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
   for (let name of $.uniques(rel)) {
      let wasNew = $.trie.add(rel[name], fact);
      if (!wasNew) {
         throw new Error(`Fact conflict`);
      }
   }
}
removeFact ::= function (rel, fact) {
   for (let name of $.uniques(rel)) {
      let didRemove = $.trie.remove(rel[name], fact);
      if (!didRemove) {
         throw new Error(`Fact missing`);
      }
   }
}
changeFact ::= function (rel, fact, newFact) {
   $.removeFact(rel, fact);
   $.addFact(rel, newFact);
}
patchFact ::= function (rel, fact, patch) {
   $.removeFact(rel, fact);
   $.addFact(rel, {...fact, ...patch});
}
