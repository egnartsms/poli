common
   objId
   equal
   chain
   lessThan
   objLessThan
   map
trie
   * as: trie
   KeyedSet
   Map
vector
   Vector
dedb-base
   addFact
   addIdentity
   makeIdentity
   patchIdentity
   baseRelation
   symAssocRels
dedb-derived
   derivedRelation
dedb-rec-key
   recKey
   recVal
dedb-index
   Fitness
dedb-query
   dumpRecencyList
   query
   queryOne
   queryIdentity
dedb-goal
   use
   and
   or
dedb-functional
   functionalRelation
dedb-aggregate
   aggregatedRelation
dedb-aggregators
   mutableSetOfUnique
-----
protoModule ::= ({})
protoEntry ::= ({})
box module ::= null
box entry ::= null
box import ::= null
box starImport ::= null
referrings ::= null
knownNames ::= null
createRelations ::= function () {
   $.protoModule[$.symAssocRels] = new Set;
   $.protoEntry[$.symAssocRels] = new Set;

   $.module = $.baseRelation({
      name: 'module',
      protoIdentity: $.protoModule,
      attrs: ['idty', 'name', 'lang', 'members', 'ns', 'nsDelta'],
      indices: [
         ['idty', 1],
         ['name', 1]
      ]
   });
   
   $.entry = $.baseRelation({
      name: 'entry',
      protoIdentity: $.protoEntry,
      attrs: ['idty', 'module', 'name', 'def', 'isBox'],
      indices: [
         ['idty', 1],
         ['module', 'name', 1],
      ]
   });

   $.import = $.baseRelation({
      name: 'import',
      attrs: ['entry', 'recp', 'alias'],
      indices: [
         ['recp'],
         ['entry']
      ]
   });

   $.starImport = $.baseRelation({
      name: 'starImport',
      attrs: ['donor', 'recp', 'alias'],
      indices: [
         ['recp']
      ]
   });

   // Trying out: derived/aggregated relations
   let equal = $.functionalRelation({
      name: 'equal',
      attrs: ['left', 'right'],
      instantiations: {
         '++': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vLeft, vRight) {
               if (ns[vLeft] === ns[vRight]) {
                  yield;
               }
            }
         },
         '+-': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vLeft, vRight) {
               ns[vRight] = ns[vLeft];
               yield;
            }
         },
         '-+': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vLeft, vRight) {
               ns[vLeft] = ns[vRight];
               yield;
            }
         },
      }
   })

   let nonNull = $.functionalRelation({
      name: 'nonNull',
      attrs: ['value'],
      instantiations: {
         '+': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vValue) {
               if (ns[vValue] !== null) {
                  yield;
               }
            }
         }
      }
   })

   let isNull = $.functionalRelation({
      name: 'isNull',
      attrs: ['value'],
      instantiations: {
         '+': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vValue) {
               if (ns[vValue] === null) {
                  yield;
               }
            }
         },
         '-': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vValue) {
               ns[vValue] = null;
               yield;
            }
         }
      }
   })

   let definitionReferrings = $.functionalRelation({
      name: 'definitionReferrings',
      attrs: ['def', 'referrings'],
      instantiations: {
         '+-': {
            fitness: $.Fitness.uniqueHit,
            *run(ns, vDef, vReferrings) {
               let re = /(?<![\w$])(?<=\$\.)(\w+(?:\.\w+)?)\b/g;

               ns[vReferrings] = new Set(
                  $.map(ns[vDef].matchAll(re), ([match]) => match)
               );

               yield;
            }
         },
      }
   });

   $.referrings = $.derivedRelation({
      name: 'referrings',
      attrs: ['module', 'entry', 'referrings'],
      hardIndices: [['entry', 1]],
      body: v => [
         $.use($.entry, {idty: v`entry`, module: v`module`, def: v`def`}),
         $.use(definitionReferrings, {def: v`def`, referrings: v`referrings`})
      ]
   })

   $.knownNames = $.aggregatedRelation({
      name: 'knownNames',
      groupBy: ['module'],
      aggregates: {
         names: $.mutableSetOfUnique('name')
      },
      source: v => [
         $.use($.module, {idty: v`module`}),
         $.or(
            // own entries
            $.use($.entry, {module: v`module`, name: v`name`}),
            // entry imports
            $.and(
               $.use($.import, {recp: v`module`, entry: v`entry`, alias: v`alias`}),
               // either aliased or not
               $.or(
                  // aliased
                  $.and(
                     $.use(nonNull, {value: v`alias`}),
                     $.use(equal, {left: v`alias`, right: v`name`})
                  ),
                  // not aliased
                  $.and(
                     $.use(isNull, {value: v`alias`}),
                     $.use($.entry, {idty: v`entry`, name: v`name`})
                  )
               )
            ),
            // star imports
            $.use($.starImport, {recp: v`module`, alias: v`name`})
         )
      ]
   })
}
load ::= function (minfos) {
   console.time('load world');

   $.createRelations();

   // Modules and entries
   for (let minfo of minfos) {
      // minfo :: [{name, lang, imports, body, ns}]
      let module = $.makeIdentity($.protoModule);

      $.addIdentity($.module, {
         idty: module,
         name: minfo.name,
         lang: minfo.lang,
         members: null,
         // These are mutable
         ns: minfo.ns,
         nsDelta: Object.create(null),
      });

      let entries = Array.from(minfo.body, ({isBox, name, def}) => {
         let entry = $.makeIdentity($.protoEntry);

         $.addIdentity($.entry, {
            idty: entry,
            name,
            def,
            isBox,
            module
         })

         return entry;
      });

      $.patchIdentity($.module, module, m => ({
         ...m,
         members: $.Vector(entries)
      }));
   }

   // Imports
   for (let {name: recpName, imports} of minfos) {
      let recp = $.queryIdentity($.module, {name: recpName});
      
      for (let {donor: donorName, asterisk, imports: entryImports} of imports) {
         let donor = $.queryIdentity($.module, {name: donorName});

         if (asterisk !== null) {
            $.addFact($.starImport, {donor, recp, alias: asterisk});
         }

         for (let {entry: entryName, alias} of entryImports) {
            let entry = $.queryIdentity($.entry, {module: donor, name: entryName});

            $.addFact($.import, {entry, recp, alias});
         }
      }
   }

   console.timeEnd('load world');

   $.dumpRecencyList();
}
