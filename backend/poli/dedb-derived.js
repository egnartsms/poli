common
   arraysEqual
   assert
   check
   hasOwnProperty
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   indexRange
   enumerate
   hasNoEnumerableProps
   singleQuoteJoinComma
   map
   mapfilter
   filter
   setDefault
   zip
   produceArray
   multimap
   mmapAdd
   mmapDelete
dedb-rec-key
   recAttr
   recKey
   recVal
   plainAttrs
   normalizeAttrsForPk
   recByKey
   recKeyOf
   Keyed
   makeAccessors
dedb-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeRecords
dedb-goal
   * as: goal
dedb-version
   refCurrentState
   releaseVersion
   isVersionUpToDate
   unchainVersions
   verAdd1
   verRemove1
dedb-index
   copyIndex
   isIndexCovered
   indexAdd
   indexRemove
   indexAt
dedb-index-instance
   refIndexInstance
   releaseIndexInstance
   indexInstanceStorage
dedb-join-plan
   computeIncrementalUpdatePlan
   makeSubBoundAttrsProducer
   narrowConfig
   JoinType
dedb-relation
   RelationType
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

   function getvar(name) {
      return {
         [$.goal.lvarSym]: name
      }
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

   $.goal.numberRelGoals(rootGoal);

   let {appliedIndices, plan} = $.computeIncrementalUpdatePlan(rootGoal);
   let config0 = {
      attrs,
      plainAttrs,
      lvars,
      appliedIndices,
      plan,
   };

   return {
      type: $.RelationType.derived,
      keyed: keyed,
      name: relname,
      attrs: attrs,
      indices: indices,
      subRels: Array.from($.goal.walkRelGoals(rootGoal), goal => goal.rel),
      subBoundAttrsProducer: $.makeSubBoundAttrsProducer(rootGoal, attrs),
      config0: config0,
      configs: {0: config0},
      projmap: new Map,

      at(attrs) {
         return $.goal.relGoal(this, attrs);
      }
   };
}
makeProjection ::= function (rel, boundAttrs) {
   let config = $.configFor(rel, boundAttrs);

   let subProjs = [];
   let subVers = [];

   for (let [subRel, subBoundAttrs] of
         $.zip(rel.subRels, rel.subBoundAttrsProducer(boundAttrs))) {
      let proj = $.projectionFor(subRel, subBoundAttrs);

      proj.refcount += 1;
      subProjs.push(proj);
      subVers.push(null);
   }

   let subIndexInstances = Array.from(
      config.appliedIndices,
      ({projNum, index}) => $.refIndexInstance(subProjs[projNum], index)
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
      records: null,  // dry in the beginning
      // forward: rkey -> [subkey, subkey, ...]
      recDeps: new Map,
      // backward: [ {subkey -> Set{rkey, rkey, ...}}, ...], by the number of subProjs
      subrecDeps: $.produceArray(subProjs.length, () => $.multimap()),
      myIndexInstances: $.indexInstanceStorage(),
      validRevDeps: new Set,

      ...$.makeAccessors(rel.keyed),
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
      rel.configs[cfgkey] = $.narrowConfig(rel.config0, Reflect.ownKeys(boundAttrs));
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

   let {rel, config} = proj;

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   for (let i = 0; i < proj.subProjs.length; i += 1) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subProjs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(proj.subProjs[i]);
      if (proj.subVers[i] !== null) {
         $.releaseVersion(proj.subVers[i]);
      }
      proj.subVers[i] = newVer;
   }

   let ns = Object.fromEntries($.map(config.lvars, lvar => [lvar, undefined]));
   
   // In case if proj is keyed, we need 'recKey' and probably 'recVal' in 'ns' anyways,
   // even if any of them is bound. That's different form plain attributes which can
   // be omitted if bound.
   if (proj.keyed !== false) {
      if ($.hasOwnProperty(proj.boundAttrs, $.recKey)) {
         ns[$.recKey] = proj.boundAttrs[$.recKey];
      }
      
      if (proj.keyed === $.Keyed.direct && $.hasOwnProperty(proj.boundAttrs, $.recVal)) {
         ns[$.recVal] = proj.boundAttrs[$.recVal];
      }
   }

   let subKeys = new Array(proj.subProjs.length).fill(null);

   function run(jnode) {
      if (jnode === null) {
         let rec = $.makeRecordFor(proj, ns);

         proj.records.add(rec);
         $.recDep(proj, proj.recKey(rec), subKeys);

         for (let idxInst of proj.myIndexInstances) {
            $.indexAdd(idxInst, rec);
         }

         return;
      }
      
      if (jnode.type === $.JoinType.either) {
         for (let branch of jnode.branches) {
            run(branch);
         }

         return;
      }

      if (jnode.type === $.JoinType.func) {
         for (let _ of $.joinFuncRel(proj, jnode, ns)) {
            run(jnode.next);
         }

         return;
      }

      let subProj = proj.subProjs[jnode.projNum];

      outer:
      for (let subrec of $.joinRecords(proj, jnode, ns)) {
         for (let [attr, lvar] of jnode.checkAttrs) {
            if (subProj.recAttr(subrec, attr) !== ns[lvar]) {
               continue outer;
            }
         }

         for (let [attr, lvar] of jnode.extractAttrs) {
            ns[lvar] = subProj.recAttr(subrec, attr);
         }

         subKeys[jnode.projNum] = subProj.recKey(subrec);
         run(jnode.next);
         subKeys[jnode.projNum] = null;
      }
   }

   let [subproj0] = proj.subProjs;
   
   proj.records = $.makeRecords(proj, []);

   for (let rec of subproj0.records) {
      for (let [attr, lvar] of config.plan[0].startAttrs) {
         ns[lvar] = subproj0.recAttr(rec, attr);
      }

      subKeys[0] = subproj0.recKey(rec);
      run(config.plan[0].joinTree);
      subKeys[0] = null;
   }
  
   $.markProjectionValid(proj);
}
updateProjection ::= function (proj) {
   if (proj.isValid) {
      return;
   }

   if (proj.records === null) {
      // This is a 'dry' projection
      $.rebuildProjection(proj);
      return;
   }

   for (let subProj of proj.subProjs) {
      $.gUpdateProjection(subProj);
   }

   // Remove
   function removeForSubkeyRemoval(subNum, subKeys) {
      for (let subKey of subKeys) {
         let rkeys = $.subrecUndep(proj, subNum, subKey);

         for (let rkey of rkeys) {
            let rec = proj.recAtKey(rkey);

            proj.records.delete(rkey);

            if (proj.myVer !== null) {
               $.verRemove1(proj.myVer, rkey);
            }

            for (let idxInst of proj.myIndexInstances) {
               $.indexRemove(idxInst, rec);
            }
         }
      }
   }

   // projNum => ver.added
   let subNum2Added = new Map;

   for (let [subNum, subVer] of $.enumerate(proj.subVers)) {
      if ($.isVersionUpToDate(subVer)) {
         continue;
      }

      $.unchainVersions(subVer);

      if (subVer.removed.size > 0) {
         removeForSubkeyRemoval(subNum, subVer.removed);
      }
      if (subVer.added.size > 0) {
         subNum2Added.set(subNum, subVer.added);
      }
   }

   // Add
   let {config} = proj;
   let ns = Object.fromEntries($.map(config.lvars, lvar => [lvar, undefined]));

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

   let subKeys = new Array(proj.subProjs.length).fill(null);

   for (let [dsubNum, subAdded] of subNum2Added) {
      let dsubProj = proj.subProjs[dsubNum];
      let plan = config.plan[dsubNum];

      function run(jnode) {
         if (jnode === null) {
            let rec = $.makeRecordFor(proj, ns);
            let rkey = proj.recKey(rec);

            proj.records.add(rec);
            $.recDep(proj, rkey, subKeys);

            for (let idxInst of proj.myIndexInstances) {
               $.indexAdd(idxInst, rec);
            }

            if (proj.myVer !== null) {
               $.verAdd1(proj.myVer, rkey);
            }

            return;
         }
         
         if (jnode.type === $.JoinType.either) {
            for (let branch of jnode.branches) {
               run(branch);
            }

            return;
         }

         if (jnode.type === $.JoinType.func) {
            for (let _ of $.joinFuncRel(proj, jnode, ns)) {
               run(jnode.next);
            }

            return;
         }

         let subProj = proj.subProjs[jnode.projNum];
         let keysToExclude = (
            jnode.projNum < dsubNum ? subNum2Added.get(jnode.projNum) ?? new Set : new Set
         );

         outer:
         for (let subRec of $.joinRecords(proj, jnode, ns)) {
            let subKey = subProj.recKey(subRec);

            if (keysToExclude.has(subKey)) {
               continue;
            }

            for (let [attr, lvar] of jnode.checkAttrs) {
               if (subProj.recAttr(subRec, attr) !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let [attr, lvar] of jnode.extractAttrs) {
               ns[lvar] = subProj.recAttr(subRec, attr);
            }

            subKeys[jnode.projNum] = subKey;
            run(jnode.next);
            subKeys[jnode.projNum] = null;
         }
      }

      for (let subKey of subAdded) {
         let subRec = dsubProj.recAtKey(subKey);

         for (let [attr, lvar] of plan.startAttrs) {
            ns[lvar] = dsubProj.recAttr(subRec, attr);
         }

         subKeys[dsubNum] = subKey;
         run(plan.joinTree);
         subKeys[dsubNum] = null;
      }
   }

   // Finally ref new subversions
   for (let i = 0; i < proj.subVers.length; i += 1) {
      if (!$.isVersionUpToDate(proj.subVers[i])) {
         let newVer = $.refCurrentState(proj.subProjs[i]);
         $.releaseVersion(proj.subVers[i]);
         proj.subVers[i] = newVer;
      }
   }

   $.markProjectionValid(proj);
}
joinFuncRel ::= function (proj, jnode, ns) {
   let {run, args} = jnode;
   let array = [ns];

   for (let arg of args) {
      if ($.hasOwnProperty(arg, 'getValue')) {
         array.push(arg.getValue(proj.boundAttrs));
      }
      else {
         let {isBound, lvar} = arg;

         array.push(isBound ? ns[lvar] : lvar);
      }
   }
   
   return run.apply(null, array);
}
joinRecords ::= function (proj, jnode, ns) {
   let {type, projNum} = jnode;
   let subProj = proj.subProjs[projNum];
   
   if (type === $.JoinType.all) {
      return subProj.records;
   }

   if (type === $.JoinType.pk) {
      return [subProj.records.getEntry(ns[jnode.pklvar])];
   }

   if (type === $.JoinType.index) {
      let {indexNum, indexLvars} = jnode;

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

   throw new Error(`Cannot handle this join type here: ${type}`);
}
makeRecordFor ::= function (proj, ns) {
   if (proj.keyed === false) {
      return Object.fromEntries($.map(proj.config.plainAttrs, a => [a, ns[a]]));
   }
   else if (proj.keyed === $.Keyed.direct) {
      return [ns[$.recKey], ns[$.recVal]];
   }
   else if (proj.keyed === $.Keyed.wrapped) {
      return [
         ns[$.recKey],
         Object.fromEntries($.map(proj.config.plainAttrs, a => [a, ns[a]]))
      ];
   }
   else {
      throw new Error;
   }
}
recDep ::= function (proj, rkey, subKeys) {
   subKeys = Array.from(subKeys);
   proj.recDeps.set(rkey, subKeys);

   for (let [mmap, subKey] of $.zip(proj.subrecDeps, subKeys)) {
      $.mmapAdd(mmap, subKey, rkey);
   }
}
subrecUndep ::= function (proj, nsub, subKey) {
   // We need to make a copy because this set is going to be modified inside the loop
   let rkeys = Array.from(proj.subrecDeps[nsub].get(subKey) || []);

   for (let rkey of rkeys) {
      $.recUndep(proj, rkey);
   }

   return rkeys;
}
recUndep ::= function (proj, rkey) {
   let subKeys = proj.recDeps.get(rkey);

   for (let [mmap, subKey] of $.zip(proj.subrecDeps, subKeys)) {
      if (subKey !== null) {
         $.mmapDelete(mmap, subKey, rkey);
      }
   }

   proj.recDeps.delete(rkey);
}
