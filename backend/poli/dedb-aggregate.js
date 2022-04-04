common
   assert
   check
   all
   isA
   notAny
   map
   concat
   chain
   produceArray
   trackingFinal
   zip
set-map
   intersection
dedb-relation
   accessorForAttr
dedb-projection
   makeProjectionRegistry
   projectionFor
   releaseProjection
   updateProjection as: updateGenericProjection
dedb-derived
   derivedRelation
dedb-version
   makeZeroVersion
   releaseVersion
   versionAdd
   versionRemove
   versionAddedRecords
   versionRemovedRecords
   refProjectionState
dedb-index-instance
   indexAdd
   indexRemove
-----
aggregatedRelation ::= function ({
   name: relname,
   groupBy,
   aggregates,
   source
}) {
   if ($.intersection(groupBy, Object.keys(aggregates)).size > 0) {
      throw new Error(`'${relname}': groupBy and aggregates intersect`);
   }

   let usedVars = Array.from(
      new Set(
         [...groupBy, ...$.chain($.map(Object.values(aggregates), ({vars}) => vars))]
      )
   )

   if (typeof source === 'function') {
      source = $.derivedRelation({
         name: `agg:${relname}`,
         attrs: usedVars,
         body: source
      });
   }
   else {
      // Check that 'source' has all requested attributes
      $.check($.all(usedVars, attr => source.attrs.includes(attr)), () =>
         `'${relname}': '${source.name}' does not have some of requested attrs`
      )
   }

   return {
      kind: 'aggregate',
      name: relname,
      attrs: [...groupBy, ...Object.keys(aggregates)],
      groupBy,
      aggNames: Object.keys(aggregates),
      aggFactories: Object.values(aggregates).map(({make}) => make),
      sourceRel: source,
      projections: $.makeProjectionRegistry(),
   }
}
makeProjection ::= function (rel, bindings) {
   let groupBy = Array.from(rel.groupBy);

   for (let [attr, val] of Object.entries(bindings)) {
      let idx = groupBy.indexOf(attr);

      if (idx !== -1) {
         groupBy.splice(idx, 1);
      }
      else {
         throw new Error(`Cannot bind '${attr}' in aggregation '${rel.name}'`);
      }
   }

   $.check(groupBy.length > 0, () =>
      `Aggregation '${rel.name}': 0-dimensional projections not supported`
   );

   let sourceProj = $.projectionFor(rel.sourceRel, bindings);

   sourceProj.refCount += 1;

   let proj = {
      kind: 'aggregate',
      rel,
      refCount: 0,
      regPoint: null,  // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      sourceProj,
      depVer: $.makeZeroVersion(sourceProj),
      groupBy,
      recordMap: groupBy.length === 0 ? null : new Map,
      size: 0,
      Agroup2agg: groupBy.length === 0 ? 
         Array.from(rel.aggNames, () => null) :
         Array.from(rel.aggNames, () => new Map),
      myVer: null,
      myInsts: []
   };

   $.updateProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   $.releaseVersion(proj.depVer);
   $.releaseProjection(proj.sourceProj);
}
markAsValid ::= function (proj) {
   proj.sourceProj.validRevDeps.add(proj);
   proj.isValid = true;
}
updateProjection ::= function (proj) {
   $.updateGenericProjection(proj.sourceProj);

   let {rel} = proj;

   let newGroups = new Set;
   let dirtyGroups = new Set;

   // Remove
   for (let rec of $.versionRemovedRecords(proj.depVer)) {
      let map = proj.recordMap;

      for (let attr of proj.groupBy) {
         map = map.get(rec[attr]);
      }

      let group = map;

      for (let group2agg of proj.Agroup2agg) {
         group2agg.get(group).remove(rec);
      }

      group[$.symCount] -= 1;
      dirtyGroups.add(group);
   }

   // Add
   for (let rec of $.versionAddedRecords(proj.depVer)) {
      let map = proj.recordMap;
      
      for (let [attr, isFinal] of $.trackingFinal(proj.groupBy)) {
         let next = map.get(rec[attr]);

         if (next === undefined) {
            if (isFinal) {
               // Create a new group
               let group = Object.fromEntries([
                  [$.symCount, 0],
                  [$.symParent, map],
                  ...$.map(proj.groupBy, attr => [attr, rec[attr]]),
                  ...$.map(rel.aggNames, name => [name, undefined])
               ]);

               for (let [fnmake, group2agg] of $.zip(rel.aggFactories, proj.Agroup2agg)) {
                  group2agg.set(group, fnmake());
               }

               next = group;
               newGroups.add(group);
            }
            else {
               next = Object.assign(new Map, {
                  parent: map,
                  key: rec[attr]
               });
            }

            map.set(rec[attr], next);
         }

         map = next;
      }

      let group = map;

      for (let group2agg of proj.Agroup2agg) {
         let agg = group2agg.get(group);
         agg.add(rec);
      }

      group[$.symCount] += 1;
      dirtyGroups.add(group);
   }

   // Process dirty groups
   let newValues = [];

   for (let group of dirtyGroups) {
      if (newGroups.has(group)) {
         for (let [aggName, group2agg] of $.zip(rel.aggNames, proj.Agroup2agg)) {
            group[aggName] = group2agg.get(group).value();
         }

         if (proj.myVer !== null) {
            $.versionAdd(proj.myVer, group);
         }

         for (let inst of proj.myInsts) {
            $.indexAdd(inst, group);
         }

         proj.size += 1;
      }
      else if (group[$.symCount] === 0) {
         let map = group[$.symParent];

         map.delete(group[proj.groupBy.at(-1)]);

         while (map.size === 0 && map.parent !== null) {
            map.parent.delete(map.key);
            map = map.parent;
         }

         for (let group2agg of proj.Agroup2agg) {
            group2agg.delete(group);
         }

         if (proj.myVer !== null) {
            $.versionRemove(proj.myVer, group);
         }

         for (let inst of proj.myInsts) {
            $.indexRemove(inst, group);
         }

         proj.size -= 1;
      }
      else {
         newValues.length = 0;

         let changed = false;

         for (let [aggName, group2agg] of $.zip(rel.aggNames, proj.Agroup2agg)) {
            let agg = group2agg.get(group);
            let oldValue = group[aggName];
            let newValue = agg.value();

            newValues.push(newValue);

            if (oldValue !== newValue) {
               changed = true;
            }
         }

         if (changed) {
            let newGroup = {...group};

            for (let [aggName, newValue] of $.zip(rel.aggNames, newValues)) {
               newGroup[aggName] = newValue;
            }

            group[$.symParent].set(group[proj.groupBy.at(-1)], newGroup);

            for (let group2agg of proj.Agroup2agg) {
               group2agg.set(newGroup, group2agg.get(group));
               group2agg.delete(group);
            }

            if (proj.myVer !== null) {
               $.versionRemove(proj.myVer, group);
               $.versionAdd(proj.myVer, newGroup);
            }

            for (let inst of proj.myInsts) {
               $.indexRemove(inst, group);
               $.indexAdd(inst, newGroup);
            }
         }
      }
   }

   let newVer = $.refProjectionState(proj.sourceProj);
   $.releaseVersion(proj.depVer);
   proj.depVer = newVer;

   $.markAsValid(proj);
}
symCount ::= Symbol.for('poli.count')
symParent ::= Symbol.for('poli.parent')
