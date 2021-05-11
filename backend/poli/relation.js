common
   assert
   hasOwnProperty
   lessThan
   newObj
   patchObj
trie
   * as: trie
-----
proto ::= ({
   [Symbol.iterator] () {
      return $.facts(this);
   }
})
Relation ::= function ({pk, groupings, facts=null}) {
   $.assert($.hasOwnProperty(groupings, pk));

   let rel = $.newObj($.proto, {
      pk: pk,
      groupings: $.prepareGroupings(groupings)
   });

   for (let [name, {cons}] of rel.groupings) {
      $.assert(!$.hasOwnProperty(rel, name));
      rel[name] = cons();
   }

   if (facts !== null) {
      $.addFacts(rel, facts);
   }

   return rel;
}
prepareGroupings ::= function (groupings) {
   function groupFn(prop) {
      return typeof prop === 'string' ? (x => x[prop]) : prop;
   }

   function makeChain(props) {
      if (!(props instanceof Array)) {
         props = [props];
      }

      let head = {};
      let link = head;

      for (let i = 0; i < props.length - 1; i += 1) {
         let prop = props[i];

         let newLink = {
            cons: $.trie.Map,
            groupFn: groupFn(prop),
            next: null
         };

         link.next = newLink;
         link = newLink;
      }

      link.next = {
         cons: () => $.trie.KeyedSet(groupFn(props[props.length - 1])),
         next: null
      };

      return head.next;
   }

   return Object.entries(groupings).map(([name, props]) => [name, makeChain(props)]);
}
copy ::= function (rel) {
   $.freeze(rel);
   return $.newObj($.proto, rel);
}
freeze ::= function (rel) {
   function freeze(map, link) {
      map.isFresh = false;

      if (link.next !== null) {
         for (let val of $.trie.values(map)) {
            if (val.isFresh) {
               freeze(val, link.next);
            }
         }
      }
   }

   for (let [name, link] of rel.groupings) {
      if (rel[name].isFresh) {
         freeze(rel[name], link);
      }
   }
}
alike ::= function (rel, facts=null) {
   let xrel = $.newObj($.proto, {
      pk: rel.pk,
      groupings: rel.groupings
   });

   for (let [name, {cons}] of rel.groupings) {
      xrel[name] = cons();
   }

   if (facts !== null) {
      $.addFacts(xrel, facts);
   }

   return xrel;
}
ensureFresh ::= function (map) {
   if (map.isFresh) {
      return map;
   }

   let xmap = $.trie.copy(map);
   xmap.isFresh = true;
   return xmap;
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
   for (let [name, link] of rel.groupings) {
      rel[name] = (function addTo(map, link) {
         let xmap = $.ensureFresh(map);
         
         if (link.next === null) {
            $.trie.addNew(xmap, fact);
            return xmap;
         }

         let key = link.groupFn(fact);
         let nextMap = $.trie.tryAt(xmap, key);

         if (nextMap === undefined) {
            nextMap = link.next.cons();
            nextMap.isFresh = true;
            $.trie.setAt(xmap, key, nextMap);
         }
         
         let xNextMap = addTo(nextMap, link.next);

         if (xNextMap !== nextMap) {
            $.trie.setAt(xmap, key, xNextMap);
         }

         return xmap;
      })(rel[name], link);
   }
}
removeFact ::= function (rel, fact) {
   for (let [name, link] of rel.groupings) {
      rel[name] = (function removeFrom(map, link) {
         let xmap = $.ensureFresh(map);

         if (link.next === null) {
            $.trie.remove(xmap, fact);
            return xmap;
         }
         
         let key = link.groupFn(fact);
         let nextMap = $.trie.at(xmap, key);
         let xNextMap = removeFrom(nextMap, link.next);

         if ($.trie.isEmpty(xNextMap)) {
            $.trie.removeAt(xmap, key);
         }
         else if (xNextMap !== nextMap) {
            $.trie.setAt(xmap, key, xNextMap);
         }

         return xmap;
      })(rel[name], link)
   }
}
changeFact ::= function (rel, fact, newFact) {
   $.removeFact(rel, fact);
   $.addFact(rel, newFact);
}
patchFact ::= function (rel, fact, patch) {
   $.changeFact(rel, fact, $.patchObj(fact, patch));
}
update ::= function (rel, fn, ...restArgs) {
   let xrel = $.copy(rel);
   fn(xrel, ...restArgs);
   return xrel;
}
