common
   check
   all
dedb-relation
   toRelation
   accessorForAttr
dedb-projection
   makeProjectionRegistry
   projectionFor
   releaseProjection
   updateProjection
dedb-version
-----
clsAggregateRelation ::= ({
   name: 'relation.aggregate',
   'relation.aggregate': true,
   'relation': true
})
makeRelation ::= function ({
   name: relname,
   groupBy: groupBySpec,
   aggregates,
   body: bodyCallback,
}) {
   let target = $.toRelation(getTargetRelInfo());
   let groupBy = $.prepareGroupByPairs(relname, groupBySpec);

   $.check($.all(groupBy, ([attr, alias]) => target.logAttrs.includes(attr)));

   return {
      class: $.clsAggregateRelation,
      name: relname,
      target,
      groupBy,
      aggregates,
      projections: $.makeProjectionRegistry(),
   }
}
prepareGroupByPairs ::= function (relname, groupBySpec) {
   let groupBy = [];

   for (let thing of groupBySpec) {
      if (typeof thing === 'string') {
         groupBy.push([thing, thing]);
      }
      else if (typeof thing === 'symbol') {
         throw new Error(
            `Aggregate '${relname}': need to give a string name to '${String(thing)}'`
         );
      }
      else if (Array.isArray(thing)) {
         $.check(thing.length === 2);

         let [attr, alias] = thing;
         $.check(typeof attr === 'string' || typeof attr === 'symbol');
         $.check(typeof alias === 'string');

         groupBy.push(thing);
      }
      else {
         throw new Error(`Invalid group by spec: '${thing}'`);
      }
   }

   return groupBy;
}
clsAggregateProjection ::= ({
   name: 'projection.aggregate',
   'projection.aggregate': true,
   'projection': true,
})
makeProjection ::= function (rel, bindings) {
   let targetBindings = Object.fromEntries(
      $.mapfilter(rel.groupBy, ([attr, alias]) => {
         if ($.hasOwnDefinedProperty(bindings, alias)) {
            return [attr, bindings[alias]];
         }
      })
   );

   let groupBy = Array.from(
      $.mapfilter(rel.groupBy, ([attr, alias]) => {
         if (!$.hasOwnDefinedProperty(bindings, alias)) {
            return [$.accessorForAttr(rel, attr), alias];
         }
      })
   );

   let target = $.projectionFor(rel.target, targetBindings);

   target.refCount += 1;

   return {
      class: $.clsAggregateProjection,
      rel,
      refCount: 0,
      regPoint: null,
      isValid: false,
      target,
      groupBy,
      depVer: null,
      records: new Map,
   }
}
freeProjection ::= function (proj) {
   if (proj.depVer !== null) {
      $.releaseExtVersion(proj.depVer);
   }

   $.releaseProjection(proj.target);
}
rebuildProjection ::= function (proj) {
   let {target, rel} = proj;

   $.updateProjection(target);

   for (let rec of $.projectionRecords(target)) {
      let map = proj.records;

      for (let [[accessor], isFinal] of $.trackingFinal(proj.groupBy)) {
         let key = accessor(rec);
         let next = map.get(key);

         if (next === undefined) {
            if (isFinal) {
               next = Object.fromEntries(
                  Object.entries(rel.aggregates).map(
                     ([name, aggregatorClass]) => [name, new aggregatorClass()]
                  )
               );
            }
            else {
               next = new Map;
            }
            
            map.set(key, next);
         }

         map = next;
      }

      // Now map is an object {name: #<aggregator object>}
      for (let aggregator of Object.values(map)) {
         aggregator.addRecord(rec);
      }
   }
}
aggRef ::= function (proj, aggregatorName, keyMap) {
   if (arguments.length === 2) {
      keyMap = aggregatorName;
      aggregatorName = null;
   }

   let map = proj.records;

   for (let [, alias] of proj.groupBy) {
      map = map.get(keyMap[alias]);

      if (map === undefined) {
         return undefined;
      }
   }

   if (aggregatorName === null) {
      return Object.fromEntries(Object.entries(map).map(
         ([name, aggregator]) => [name, aggregator.value]
      ))
   }
   else {
      let aggregator = map[aggregatorName];

      if (aggregator === undefined) {
         return undefined;
      }

      return aggregator.value;
   }
}
UniqueSet ::= class {
   constructor() {
      this.value = new Set;
   }

   addValue(rkey, value) {
      this.value.add(value);
   }

   remove
}