common
   assert
   find
   hasOwnProperty
   hasNoEnumerableProps
   iconcat
   map
   selectProps
   trackingFinal
prolog-index
   buildIndex
   indexAdd
   factualProjectionIndices
prolog-infer
   inferredRelation
   computeIncrementalUpdatePlan
   visualizeIncrementalUpdatePlan
-----
relations ::= ({})
initialize ::= function () {
   let continent = $.factualRelation({
      name: 'continent',
      attrs: ['name'],
      indices: [
         Object.assign(['name'], {unique: true})
      ],
      facts: new Set([
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]),
   });

   let country = $.factualRelation({
      name: 'country',
      attrs: ['name', 'continent'],
      indices: [
         Object.assign(['name'], {unique: true}),
         // ['name'],
         ['continent']
      ],
      facts: new Set([
         {continent: 'Europe', name: 'France'},
         {continent: 'Europe', name: 'Poland'},
         {continent: 'Europe', name: 'Ruthenia'},
         {continent: 'Asia', name: 'China'},
         {continent: 'Asia', name: 'India'},
         {continent: 'Asia', name: 'Turkey'},
         {continent: 'America', name: 'Canada'},
         {continent: 'America', name: 'USA'}
      ]),
   });

   let city = $.factualRelation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
      indices: [
         ['country']
      ],
      facts: new Set([
         {country: 'France', name: 'Paris', population: 13.024},
         {country: 'France', name: 'Marseille', population: 1.761},
         {country: 'France', name: 'Lyon', population: 2.323},

         {country: 'Poland', name: 'Warsaw', population: 3.100},
         {country: 'Poland', name: 'Wroclaw', population: 1.250},
         {country: 'Poland', name: 'Krakow', population: 1.725},

         {country: 'Ruthenia', name: 'Kyiv', population: 3.375},
         {country: 'Ruthenia', name: 'Lviv', population: 0.720},
         {country: 'Ruthenia', name: 'Dnipro', population: 0.993},

         {country: 'China', name: 'Beijing', population: 21.707},
         {country: 'China', name: 'Chongqing', population: 30.165},
         {country: 'China', name: 'Shanghai', population: 24.183},

         {country: 'India', name: 'Delhi', population: 29.000},
         {country: 'India', name: 'Mumbai', population: 24.400},
         {country: 'India', name: 'Bangalore', population: 8.443},

         {country: 'Turkey', name: 'Istanbul', population: 14.025},
         {country: 'Turkey', name: 'Ankara', population: 4.587},
         {country: 'Turkey', name: 'Izmir', population: 2.847},

         {country: 'Canada', name: 'Toronto', population: 6.417},
         {country: 'Canada', name: 'Montreal', population: 4.247},
         {country: 'Canada', name: 'Vancouver', population: 2.463}
      ])
   });

   let continent_city = $.inferredRelation(v => ({
      name: 'continent_city',
      attrs: ['continent', 'city'],
      body: [
         {
            rel: continent,
            attrs: {name: v`continent`}
         },
         {
            rel: country,
            attrs: {continent: v`continent`, name: v`country`}
         },
         {
            rel: city,
            attrs: {country: v`country`, name: v`city`}
         }
      ]
   }));

   Object.assign($.relations, {continent, country, city, continent_city});

   console.log($.visualizeIncrementalUpdatePlan(continent_city));
}
factualRelation ::= function ({name, attrs, indices, facts}) {
   $.assert(facts instanceof Set);

   let uniqueIndices = [];

   for (let index of indices) {
      index.unique = !!index.unique;

      // Build only unique indices. Normal indices will be built when the full projection
      // of this relation is needed (if ever).
      if (index.unique) {
         $.buildIndex(index, facts);
         uniqueIndices.push(index);
      }
   }

   return {
      isFactual: true,
      name: name,
      attrs: attrs,
      indices: indices,
      uniqueIndices: uniqueIndices,
      projmap: new Map,
      projs: new Set,
      validProjs: new Set,
      facts: facts,
      curver: null,
   }
}
query ::= function (rel, boundAttrs) {
   $.assert(rel.isFactual);

   let proj = $.projectionFor(rel, boundAttrs);
   $.updateProjection(proj);

   return proj.value;
}
projectionFor ::= function (rel, boundAttrs) {
   let map = rel.projmap;
   
   for (let [attr, isFinal] of $.trackingFinal(rel.attrs)) {
      let key = boundAttrs[attr] !== undefined ? boundAttrs[attr] : $.attrFree;

      if (map.has(key)) {
         map = map.get(key);
      }
      else if (isFinal) {
         let proj = $.projection(rel, boundAttrs);
         map.set(key, proj);
         map = proj;
      }
      else {
         let newMap = new Map;
         map.set(key, newMap);
         map = newMap;
      }
   }

   return map;
}
attrOmitted ::= ({
   [Symbol.toStringTag]: '_'
})
attrFree ::= ({
   [Symbol.toStringTag]: 'v'
})
projection ::= function (rel, boundAttrs) {
   $.assert(rel.isFactual);

   let base = $.refFactualRelationCurrentState(rel);
   let proj;

   if ($.hasNoEnumerableProps(boundAttrs)) {
      // for (let index of rel.normalIndices) {
      //    $.buildIndex(index, rel.facts);
      // }
      
      proj = {
         relation: rel,
         isValid: true,
         boundAttrs: null,
         normalIndices: rel.normalIndices,
         base: base,
         curver: base,
         value: rel.facts,
      };
   }
   else {
      let indices = $.factualProjectionIndices(rel.indices, boundAttrs);

      proj = {
         relation: rel,
         isValid: true,
         boundAttrs: boundAttrs,
         indices: indices,
         base: base,
         curver: {
            num: 1,
            next: null,
            refcount: 1,  // projection refs its curver
            // this will be populated when the next version is created
            delta: new Map
         },
         value: new Set(
            function* () {
               for (let fact of rel.facts) {
                  if ($.factSatisfies(fact, boundAttrs)) {
                     yield fact;
                  }
               }
            }()
         ),
      };
   }

   rel.projs.add(proj);
   $.markProjectionValid(proj);

   return proj;
}
isFullProjection ::= function (proj) {
   return proj.boundAttrs === null;
}
isScalarProjection ::= function (proj) {
   return proj.indices === null;
}
markProjectionValid ::= function (proj) {
   proj.isValid = true;
   proj.relation.validProjs.add(proj);
}
factSatisfies ::= function (fact, boundAttrs) {
   for (let [attr, val] of Object.entries(boundAttrs)) {
      if (fact[attr] !== val) {
         return false;
      }
   }

   return true;
}
refFactualRelationCurrentState ::= function (rel) {
   $.assert(rel.isFactual);

   if (rel.curver === null) {
      rel.curver = {
         num: 1,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      }
   }
   else if ($.isVersionEmpty(rel.curver)) {
      rel.curver.refcount += 1;
   }
   else {
      let newver = {
         num: 0,
         next: null,
         refcount: 1,  // that's the reference that this func adds
         delta: new Map,
      };
      $.linkNewHeadVersion(rel.curver, newver);
      rel.curver = newver;
   }

   return rel.curver;
}
isVersionEmpty ::= function (ver) {
   return ver.delta.size === 0;
}
isVersionNewest ::= function (ver) {
   return ver.next === null;
}
linkNewHeadVersion ::= function (ver0, ver1) {
   ver1.num = ver0.num + 1;
   ver0.next = ver1;
   ver1.refcount += 1;
}
releaseVersion ::= function (ver) {
   // Drop version's refcount by 1.  Works for both factual relation versions and
   // projection versions
   $.assert(ver.refcount > 0);

   ver.refcount -= 1;

   if (ver.refcount === 0 && ver.next !== null) {
      $.releaseVersion(ver.next);
   }
}
updateProjection ::= function (proj) {
   $.assert(proj.relation.isFactual);

   if (proj.isValid) {
      return;
   }

   if ($.isVersionNewest(proj.base) && $.isVersionEmpty(proj.base)) {
      $.markProjectionValid(proj);
      return;
   }

   let newBase = $.refFactualRelationCurrentState(proj.relation);

   // if they're the same we would have fallen into the if branch above
   $.assert(proj.base !== newBase);

   if ($.isFullProjection(proj)) {
      $.releaseVersion(proj.base);

      proj.base = newBase;  // already reffed it
      proj.curver = proj.base;  // always refers to the same version as 'proj.base'

      $.markProjectionValid(proj);

      return;
   }

   $.reduceVersions(proj.base);

   // Optimization: if nobody else needs our current version, there's no point in
   // computing delta for it.  Just update the 'value'
   let delta = proj.curver.refcount > 1 ? proj.curver.delta : null;

   for (let [fact, action] of proj.base.delta) {
      if (action === 'add') {
         if ($.factSatisfies(fact, proj.boundAttrs)) {
            proj.value.add(fact);
            if (delta !== null) {
               delta.set(fact, 'add');
            }
         }
      }
      else if (proj.value.has(fact)) {
         proj.value.delete(fact);
         if (delta !== null) {
            delta.set(fact, 'remove');
         }
      }
   }

   $.releaseVersion(proj.base);
   proj.base = newBase;  // already reffed it

   if (delta !== null && delta.size > 0) {
      let newver = {
         num: 0,
         next: null,
         refcount: 1,  // projection always references its curver
         delta: new Map,
      };
      $.linkNewHeadVersion(proj.curver, newver);
      $.releaseVersion(proj.curver);
      proj.curver = newver;
   }

   $.markProjectionValid(proj);
}
reduceVersions ::= function (ver) {
   if (ver.next === null || ver.next.next === null) {
      return;
   }

   let next = ver.next;

   $.reduceVersions(next);

   if (next.refcount === 1 && ver.delta.size < next.delta.size) {
      // The "next" version is only referenced by "ver" which means that after
      // this reduction operation it will be thrown away, which means we can reuse
      // its "delta" map if it's bigger than "ver.delta".
      $.mergeDelta(next.delta, ver.delta);
      ver.delta = next.delta;
      next.delta = null;
   }
   else {
      $.mergeDelta(ver.delta, next.delta);
   }

   ver.next = next.next;
   ver.next.refcount += 1;
   $.releaseVersion(next);
}
mergeDelta ::= function (dstD, srcD) {
   for (let [tuple, action] of srcD) {
      $.deltaAdd(dstD, tuple, action);
   }
}
addFact ::= function (rel, fact) {
   if (rel.facts.has(fact)) {
      throw new Error(`Duplicate fact`);
   }

   rel.facts.add(fact);

   if (rel.curver !== null) {
      $.deltaAdd(rel.curver.delta, fact, 'add');
      // for (let index of rel.uniqueIndices) {
      //    $.indexAdd(index, fact);
      // }
      $.invalidateProjs(rel);
   }
}
removeFact ::= function (rel, fact) {
   let wasRemoved = rel.facts.delete(fact);

   if (!wasRemoved) {
      throw new Error(`Missing fact`);
   }

   if (rel.curver !== null) {
      $.deltaAdd(rel.curver.delta, fact, 'remove');
      // for (let index of rel.uniqueIndices) {
      //    $.indexRemove(index, fact);
      // }
      $.invalidateProjs(rel);
   }
}
deltaAdd ::= function (delta, tuple, action) {
   let existingAction = delta.get(tuple);

   if (existingAction !== undefined) {
      $.assert(existingAction !== action);
      delta.delete(tuple);
   }
   else {
      delta.set(tuple, action);
   }
}
invalidateProjs ::= function (rel) {
   for (let proj of rel.validProjs) {
      proj.isValid = false;
   }

   rel.validProjs.clear();
}
inferredRelationProjection ::= function (rel, freeAttrs, boundAttrs) {
   // if ($.hasNoEnumerableProps(boundAttrs)) {
   //    proj = {
   //       relation: rel,
   //       isValid: true,
   //       freeAttrs: freeAttrs,
   //       boundAttrs: null,
   //       base: base,
   //       curver: base,
   //       value: rel.facts
   //    };
   // }
   // else {
   //    proj = {
   //       relation: rel,
   //       isValid: true,
   //       freeAttrs: freeAttrs,
   //       boundAttrs: boundAttrs,
   //       base: base,
   //       deps: new Map,
   //       curver: {
   //          num: 1,
   //          next: null,
   //          refcount: 1,  // projection refs its curver
   //          // this will be populated when the next version is created
   //          delta: new Map
   //       },
   //       value: new Set
   //    };

   //    for (let fact of rel.facts) {
   //       if ($.factSatisfies(fact, boundAttrs)) {
   //          let tuple = $.selectProps(fact, freeAttrs)
   //          proj.value.add(tuple);
   //          proj.deps.set(fact, tuple);
   //       }
   //    }
   // }
}
