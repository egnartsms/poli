common
   assert
   hasOwnProperty
   iconcat
   selectProps
-----
continent ::= null
country ::= null
city ::= null
initialize ::= function () {
   $.continent = $.relation({
      name: 'continent',
      attrs: ['name'],
      facts: new Set([
         {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ])
   });

   $.country = $.relation({
      name: 'country',
      attrs: ['name', 'continent'],
      facts: new Set([
         {continent: 'Europe', name: 'France'},
         {continent: 'Europe', name: 'Poland'},
         {continent: 'Europe', name: 'Ruthenia'},
         {continent: 'Asia', name: 'China'},
         {continent: 'Asia', name: 'India'},
         {continent: 'Asia', name: 'Turkey'},
         {continent: 'America', name: 'Canada'},
         {continent: 'America', name: 'USA'}
      ])
   });

   $.city = $.relation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
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
}
relation ::= function ({name, attrs, facts}) {
   return {
      isFactual: true,
      name: name,
      attrs: attrs,
      query2proj: new Map,
      projs: new Set,
      validProjs: new Set,
      facts: facts,
      curver: null,
   }
}
attrOmitted ::= new Object
attrFree ::= new Object
query ::= function (rel, freeAttrs, boundAttrs) {
   let proj = $.projByQuery(rel, freeAttrs, boundAttrs);
   $.updateProjection(proj);
   return Array.from(proj.value);
}
projByQuery ::= function (rel, freeAttrs, boundAttrs) {
   let map = rel.query2proj;
   
   for (let i = 0; i < rel.attrs.length; i += 1) {
      let attr = rel.attrs[i];
      let key;

      if ($.hasOwnProperty(boundAttrs, attr)) {
         key = boundAttrs[attr];
      }
      else if (freeAttrs.includes(attr)) {
         key = $.attrFree;
      }
      else {
         key = $.attrOmitted;
      }

      if (map.has(key)) {
         map = map.get(key);
      }
      else if (i === rel.attrs.length - 1) {
         let proj = $.makeProjection(rel, freeAttrs, boundAttrs);
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
makeProjection ::= function (rel, freeAttrs, boundAttrs) {
   let base = $.frelRefCurrentState(rel);

   let proj = {
      relation: rel,
      isValid: true,
      freeAttrs: freeAttrs,
      boundAttrs: boundAttrs,
      base: base,
      deps: new Map,
      curver: {
         num: 1,
         next: null,
         refcount: 1,  // projection refs its curver
         // this will be populated when the next version is created
         delta: new Map
      },
      value: new Set
   };

   for (let fact of rel.facts) {
      if ($.factSatisfies(fact, boundAttrs)) {
         let tuple = $.selectProps(fact, freeAttrs)
         proj.value.add(tuple);
         proj.deps.set(fact, tuple);
      }
   }
   
   rel.projs.add(proj);
   rel.validProjs.add(proj);

   return proj;
}
factSatisfies ::= function (fact, boundAttrs) {
   for (let [attr, val] of Object.entries(boundAttrs)) {
      if (fact[attr] !== val) {
         return false;
      }
   }

   return true;
}
frelRefCurrentState ::= function (rel) {
   if (rel.curver === null) {
      rel.curver = {
         num: 1,
         next: null,
         refcount: 1,
         delta: new Map,
      }
   }
   else if ($.versionEmpty(rel.curver)) {
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
versionEmpty ::= function (ver) {
   return ver.delta.size === 0;
}
linkNewHeadVersion ::= function (ver0, ver1) {
   ver1.num = ver0.num + 1;
   ver0.next = ver1;
   ver1.refcount += 1;
}
releaseVersion ::= function (ver) {
   // Drop version's refcount by 1.  Works for both factual relation versions and
   // projection versions (hence the name 'thing')
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

   if (proj.base.next === null && $.versionEmpty(proj.base)) {
      // 'base' is newest and there's nothing beyond 'base' => nothing to do
      proj.isValid = true;
      return;
   }

   let newBase = $.frelRefCurrentState(proj.relation);

   // if they're the same we would have fallen into the if branch above
   $.assert(proj.base !== newBase);

   $.reduceVersions(proj.base);

   let delta = proj.curver.delta;

   for (let [fact, action] of proj.base.delta) {
      if (action === 'remove') {
         if ($.factSatisfies(fact, proj.boundAttrs)) {
            let tuple = $.selectProps(fact, proj.freeAttrs);
            proj.value.add(tuple);
            proj.deps.set(fact, tuple);
            delta.set(tuple, 'remove');
         }
      }
      else if (proj.deps.has(fact)) {
         let tuple = proj.deps.get(fact);
         proj.value.delete(tuple);
         proj.deps.delete(fact);
         delta.set(tuple, 'add');
      }
   }

   $.releaseVersion(proj.base);
   proj.base = newBase;  // already reffed it

   if (delta.size > 0) {
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

   proj.isValid = true;
   proj.relation.validProjs.add(proj);
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
      $.deltaAdd(rel.curver.delta, fact, 'remove');
      $.invalidateProjs(rel);
   }
}
removeFact ::= function (rel, fact) {
   let wasRemoved = rel.facts.delete(fact);

   if (!wasRemoved) {
      throw new Error(`Missing fact`);
   }

   if (rel.curver !== null) {
      $.deltaAdd(rel.curver.delta, fact, 'add');
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
test ::= function () {
   console.log($.query($.country, ['name'], {continent: 'Europe'}));
   
   let t_italy = {name: 'Italy', continent: 'Europe'}
   $.addFact($.country, t_italy);
   console.log($.query($.country, ['name'], {continent: 'Europe'}));
   
   $.removeFact($.country, t_italy);
   console.log($.query($.country, ['name'], {continent: 'Europe'}));
}