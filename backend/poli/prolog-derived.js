common
   arraysEqual
   assert
   check
   hasOwnProperty
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   indexRange
   hasNoEnumerableProps
   singleQuoteJoinComma
   map
   mapfilter
   filter
   setDefault
prolog-rec-key
   recAttr
   recKey
   recVal
   plainAttrs
   normalizeAttrsForPk
   recByKey
   recKeyOf
   Keyed
prolog-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeRecords
prolog-goal
   * as: goal
prolog-version
   refCurrentState
   releaseVersion
   isVersionUpToDate
   unchainVersions
   deltaAppend
prolog-index
   copyIndex
   isIndexCovered
   indexAdd
   indexRemove
   indexAt
prolog-index-instance
   refIndexInstance
   releaseIndexInstance
   indexInstanceStorage
prolog-join-plan
   computeIncrementalUpdatePlan
   narrowConfig
   JoinType
-----
MAX_REL_ATTRS ::= 30
derivedRelation ::= function ({
   name: relname,
   attrs,
   indices=[],
   body: bodyCallback
}) {
   let {keyed, plainAttrs} = $.normalizeAttrsForPk(attrs);

   $.check(attrs.length <= $.MAX_REL_ATTRS, `Too many attributes`);

   let vpool = new Map;

   function getvar(name) {
      if (!vpool.has(name)) {
         vpool.set(name, {
            [$.goal.lvarSym]: name,
         });
      }

      return vpool.get(name);    
   }

   function vTagged(strings) {
      if (strings.length !== 1) {
         throw new Error(`Logical variable names don't support inline expressions`);
      }

      let [name] = strings;

      return getvar(name);
   }

   Object.defineProperties(vTagged, {
      recKey: {
         get() {
            return getvar($.recKey)
         }
      },
      recVal: {
         get() {
            return getvar($.recVal)
         }
      }
   });

   let rootGoal = bodyCallback(vTagged);

   if (rootGoal instanceof Array) {
      rootGoal = $.goal.and(...rootGoal);
   }
   
   let lvars = $.goal.checkVarUsage(rootGoal, attrs);
   let relGoals = Array.from($.goal.walkRelGoals(rootGoal));

   for (let i = 0; i < relGoals.length; i += 1) {
      relGoals[i].num = i;
   }

   let {indexRegistry, joinTrees} = $.computeIncrementalUpdatePlan(rootGoal, relGoals);
   console.log(indexRegistry);
   console.log(joinTrees);
   // let {jpaths, appliedIndices} = $.computeIncrementalUpdateScheme(relname, conjs);
   // let config0 = {
   //    conjs,
   //    attrs,
   //    plainAttrs,
   //    lvars,
   //    jpaths,
   //    appliedIndices
   // };

   return {
      isBase: false,
      keyed: keyed,
      name: relname,
      attrs: attrs,
      indices: indices,
      // config0: config0,
      // configs: {0: config0},
      projmap: new Map,

      at: function (attrs) {
         return $.goal.relGoal(this, attrs);
      }
   };
}
makeProjection ::= function (rel, boundAttrs) {
   let config = $.configFor(rel, boundAttrs);

   let subProjs = [];
   let subVers = [];

   for (let conj of config.conjs) {
      let proj = $.projectionFor(conj.rel, conj.firmAttrs);

      proj.refcount += 1;
      subProjs.push(proj);
      subVers.push(null);
   }

   let subIndexInstances = Array.from(
      config.appliedIndices,
      index => $.refIndexInstance(subProjs[index.forConjNum], index)
   );

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: false,
      keyed: rel.keyed,
      boundAttrs: boundAttrs,
      config: config,
      subProjs: subProjs,
      subVers: subVers,
      subIndexInstances: subIndexInstances,
      myVer: null,
      records: null,  // lean in the beginning
      // forward: rkey -> [subkey, subkey, ...]
      recDeps: new Map,
      // backward: subkey -> Set{rkey, rkey, ...}
      subrecDeps: new Map,
      indexInstances: $.indexInstanceStorage(),
      validRevDeps: new Set,
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let idxInst of proj.subIndexInstances) {
      $.releaseIndexInstance(idxInst);
   }

   for (let subVer of proj.subVers) {
      $.releaseVersion(subVer);
   }

   for (let subProj of proj.subProjs) {
      subProj.validRevDeps.delete(proj);
      $.releaseProjection(subProj);
   }
}
markProjectionValid ::= function (proj) {
   for (let subProj of proj.subProjs) {
      subProj.validRevDeps.add(proj);
   }

   proj.isValid = true;
}
configFor ::= function (rel, boundAttrs) {
   let cfgkey = $.boundAttrs2ConfigKey(rel.attrs, boundAttrs);

   if (!$.hasOwnProperty(rel.configs, cfgkey)) {
      rel.configs[cfgkey] = $.narrowConfig(rel.config0, boundAttrs);
   }
   
   return rel.configs[cfgkey];
}
boundAttrs2ConfigKey ::= function (attrs, boundAttrs) {
   let cfgkey = 0;

   for (let i = 0; i < attrs.length; i += 1) {
      if ($.hasOwnProperty(boundAttrs, attrs[i])) {
         cfgkey |= (1 << i);
      }
   }

   return cfgkey;
}
rebuildProjection ::= function (proj) {
   $.check(proj.myVer === null, `Cannot rebuild projection which is referred to`);

   let {rel} = proj;
   let {conjs: [conj0], jpaths: [jpath0]} = proj.config;
   let [subproj0] = proj.subProjs;

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   for (let i = 0; i < proj.subVers.length; i += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subProjs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(proj.subProjs[i]);
      if (proj.subVers[i] !== null) {
         $.releaseVersion(proj.subVers[i]);
      }
      proj.subVers[i] = newVer;
   }

   let ns = Object.fromEntries($.map(proj.config.lvars, lvar => [lvar, undefined]));
   
   // In case if proj is keyed, we need 'recKey' and probably 'recVal' anyways, even
   // if any of them is bound. That's different form plain attributes that can safely
   // be omitted from the record object if bound.
   if (proj.keyed !== false) {
      if ($.hasOwnProperty(proj.boundAttrs, $.recKey)) {
         ns[$.recKey] = proj.boundAttrs[$.recKey];
      }
      
      if (proj.keyed === $.Keyed.direct && $.hasOwnProperty(proj.boundAttrs, $.recVal)) {
         ns[$.recVal] = proj.boundAttrs[$.recVal];
      }
   }

   let subKeys = [];

   function run(k) {
      if (k === jpath0.length) {
         let [recKey, rec] = $.makeRecordFor(proj, ns);

         $.recDep(proj, recKey, subKeys);
         proj.records.add(rec);

         return;
      }

      let jplink = jpath0[k];
      let {conjNum, checkAttrs, extractAttrs} = jplink;
      let subProj = proj.subProjs[conjNum];
      let records = $.joinRecords(proj, jplink, ns);
     
      outer:
      for (let sub of records) {
         for (let [attr, lvar] of checkAttrs) {
            if ($.recAttr(sub, attr, subProj.keyed) !== ns[lvar]) {
               continue outer;
            }
         }

         for (let [attr, lvar] of extractAttrs) {
            ns[lvar] = $.recAttr(sub, attr, subProj.keyed);
         }

         subKeys.push($.recKeyOf(subProj, sub));
         run(k + 1);
         subKeys.pop();
      }
   }

   proj.records = $.makeRecords([], proj.keyed);
   proj.records.owner = proj;

   for (let rec of subproj0.records) {
      for (let [attr, lvar] of conj0.looseAttrs) {
         ns[lvar] = $.recAttr(rec, attr, subproj0.keyed);
      }

      subKeys.push(subproj0.keyed ? rec[0] : rec);
      run(0);
      subKeys.pop();
   }
  
   $.markProjectionValid(proj);
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if (proj.records === null) {
      // This is a 'lean' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   // subDeltas: conjNum => delta
   let subDeltas = new Map;

   for (let i = 0; i < proj.config.conjs.length; i += 1) {
      let subVer = proj.subVers[i];

      if (!$.isVersionUpToDate(subVer)) {
         $.unchainVersions(subVer);
         subDeltas.set(i, subVer.delta);
      }
   }

   // Remove
   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   for (let [, subDelta] of subDeltas) {
      for (let [subKey, action] of subDelta) {
         if (action === 'remove' || action === 'change') {
            let rkeys = $.subrecUndep(proj, subKey);

            for (let rkey of rkeys) {
               let rec = $.recByKey(proj, rkey);

               proj.records.delete(rkey);

               if (delta !== null) {
                  $.deltaAppend(delta, proj.keyed, rkey, 'remove');
               }

               for (let idxInst of proj.indexInstances) {
                  $.indexRemove(idxInst, rec);
               }
            }
         }
      }
   }

   // Add
   let ns = Object.fromEntries($.map(proj.config.lvars, lvar => [lvar, undefined]));

   // In case if proj is keyed, we need 'recKey' and probably 'recVal' anyways, even
   // if any of them is bound. That's different from plain attributes that can safely
   // be omitted from the record object if bound.
   if (proj.keyed !== false) {
      if ($.hasOwnProperty(proj.boundAttrs, $.recKey)) {
         ns[$.recKey] = proj.boundAttrs[$.recKey];
      }
      
      if (proj.keyed === $.Keyed.direct && $.hasOwnProperty(proj.boundAttrs, $.recVal)) {
         ns[$.recVal] = proj.boundAttrs[$.recVal];
      }
   }

   for (let [dconjNum, subDelta] of subDeltas) {
      let dconj = proj.config.conjs[dconjNum];
      let jpath = proj.config.jpaths[dconjNum];
      let dsubProj = proj.subProjs[dconjNum];

      let subKeys = [];

      function run(k) {
         if (k === jpath.length) {
            let [recKey, rec] = $.makeRecordFor(proj, ns);

            proj.records.add(rec);

            $.recDep(proj, recKey, subKeys);

            if (delta !== null) {
               $.deltaAppend(delta, proj.keyed, recKey, 'add');
            }

            for (let idxInst of proj.indexInstances) {
               $.indexAdd(idxInst, rec);
            }

            return;
         }

         let jplink = jpath[k];
         let {conjNum, checkAttrs, extractAttrs} = jplink;
         let subProj = proj.subProjs[conjNum];
         let records = $.joinRecords(proj, jplink, ns);
         
         // noDelta is used to exclude records that belong to deltas of already-processed
         // conjuncts (as we process in order, an already processed is the one with lesser
         // number)
         let noDelta = conjNum < dconjNum ? subDeltas.get(conjNum) || null : null;
         
         outer:
         for (let sub of records) {
            let subKey = $.recKeyOf(subProj, sub);

            if (noDelta !== null && noDelta.has(subKey)) {
               continue;
            }

            for (let [attr, lvar] of checkAttrs) {
               if ($.recAttr(sub, attr, subProj.keyed) !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let [attr, lvar] of extractAttrs) {
               ns[lvar] = $.recAttr(sub, attr, subProj.keyed);
            }

            subKeys.push(subKey);
            run(k + 1);
            subKeys.pop();
         }
      }

      for (let [subKey, action] of subDelta) {
         if (action === 'add' || action === 'change') {
            let sub = $.recByKey(dsubProj, subKey);

            for (let [attr, lvar] of dconj.looseAttrs) {
               ns[lvar] = $.recAttr(sub, attr, dsubProj.keyed);
            }
            
            subKeys.push(subKey);
            run(0);
            subKeys.pop();
         }
      }
   }

   // Finally ref new sub versions
   for (let conjNum of subDeltas.keys()) {
      let newVer = $.refCurrentState(proj.subProjs[conjNum]);
      $.releaseVersion(proj.subVers[conjNum]);
      proj.subVers[conjNum] = newVer;
   }

   $.markProjectionValid(proj);
}
joinRecords ::= function (proj, jplink, ns) {
   let {type, conjNum} = jplink;
   let subProj = proj.subProjs[conjNum];

   if (type === $.JoinLinkType.all) {
      return subProj.records;
   }

   if (type === $.JoinLinkType.pk) {
      $.assert(() => subProj.keyed !== false);

      let {pkLvar} = jplink;
      return [subProj.records.getEntry(ns[pkLvar])];
   }
   
   $.assert(() => type === $.JoinLinkType.indexed);

   let {indexNum, indexLvars} = jplink;

   let rkeys = $.indexAt(
      proj.subIndexInstances[indexNum], Array.from(indexLvars, lvar => ns[lvar])
   );
   
   if (subProj.keyed !== false) {
      return $.map(rkeys, rkey => subProj.records.getEntry(rkey));
   }
   else {
      return rkeys;
   }
}
makeRecordFor ::= function (proj, ns) {
   let recKey, rec;

   if (proj.keyed !== false) {
      recKey = ns[$.recKey];

      if (proj.keyed === $.Keyed.wrapped) {
         rec = [
            recKey,
            Object.fromEntries($.map(proj.config.plainAttrs, a => [a, ns[a]]))
         ];
      }
      else {
         rec = [recKey, ns[$.recVal]];
      }
   }
   else {
      rec = Object.fromEntries($.map(proj.config.plainAttrs, a => [a, ns[a]]));
      recKey = rec;
   }

   return [recKey, rec];
}
recDep ::= function (proj, rkey, subs) {
   subs = Array.from(subs);
   proj.recDeps.set(rkey, subs);

   for (let sub of subs) {
      $.setDefault(proj.subrecDeps, sub, () => new Set).add(rkey);
   }
}
subrecUndep ::= function (proj, sub) {
   // We need to make a copy because this set is going to be modified inside the loop
   let rkeys = Array.from(proj.subrecDeps.get(sub) || []);

   if (rkeys.length === 0) {
      return [];
   }

   for (let rkey of rkeys) {
      $.recUndep(proj, rkey);
   }

   return rkeys;
}
recUndep ::= function (proj, rkey) {
   let subs = proj.recDeps.get(rkey);

   for (let sub of subs) {
      let keySet = proj.subrecDeps.get(sub);

      keySet.delete(rkey);

      if (keySet.size === 0) {
         proj.subrecDeps.delete(sub);
      }
   }

   proj.recDeps.delete(rkey);
}
