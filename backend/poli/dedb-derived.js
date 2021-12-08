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
   minimumBy
   newObj
   filter
   setDefault
   zip
   produceArray
   multimap
   mmapAdd
   mmapDelete
data-structures
   RecordMap
   RecordSet
dedb-rec-key
   recKey
   recVal
   normalizeAttrs
dedb-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeProjectionRegistry
   projectionSize
   projectionRecords
dedb-goal
   * as: goal
dedb-version
   refCurrentState
   releaseVersion
   isVersionFresh
   unchainVersion
   versionAddKey
   versionRemove
dedb-index
   copyIndex
   indexFromSpec
dedb-index-instance
   refIndexInstance
   releaseIndexInstance
   indexAdd
   indexRemove
   indexRef
dedb-join-plan
   computeIncrementalUpdatePlan
   makeSubsProducer
   narrowConfig
   clsJoinAll
   clsJoinIndex
   clsJoinRecKey
   clsJoinFunc
   clsJoinEither
dedb-common
   RecordType
   recTypeProto
   makeRecords
-----
clsDerivedRelation ::= ({
   name: 'relation.derived',
   relation: true,
   'relation.derived': true
})
MAX_REL_ATTRS ::= 30
makeRelation ::= function ({
   name: relname,
   isKeyed = false,
   attrs = [],
   potentialIndices = [],
   body: bodyCallback
}) {
   $.check(attrs.length <= $.MAX_REL_ATTRS, `Too many attributes`);
   $.check(isKeyed || attrs.length > 0);

   function vTagged(strings) {
      if (strings.length !== 1) {
         throw new Error(`Logical variable names don't support inline expressions`);
      }

      let [name] = strings;

      return $.goal.makeLvar(name);
   }

   if (isKeyed) {
      Object.defineProperties(vTagged, {
         recKey: {
            get() {
               return $.goal.makeLvar($.recKey)
            }
         },
         recVal: {
            get() {
               return $.goal.makeLvar($.recVal)
            }
         }
      });
   }

   let rootGoal = bodyCallback(vTagged);

   if (rootGoal instanceof Array) {
      rootGoal = $.goal.and(...rootGoal);
   }
   
   let logicalAttrs;

   if (isKeyed) {
      if (attrs.length === 0) {
         logicalAttrs = [$.recKey, $.recVal];
      }
      else {
         logicalAttrs = [$.recKey, ...attrs];
      }
   }
   else {
      logicalAttrs = attrs;
   }

   $.goal.assignProjNumToRelGoals(rootGoal);
   let numDeps = $.goal.assignDepNumToRelGoals(rootGoal);

   let lvars = $.goal.checkVarUsageAndReturnVars(rootGoal, logicalAttrs);

   let {appliedIndices, plan} = $.computeIncrementalUpdatePlan(rootGoal);
   let config0 = {
      attrs,
      lvars,
      appliedIndices,
      plan,
      numDeps
   };

   return {
      class: $.clsDerivedRelation,
      name: relname,
      attrs: attrs,
      indices: Array.from(potentialIndices, $.indexFromSpec),
      subsProducer: $.makeSubsProducer(rootGoal, logicalAttrs),
      config0: config0,
      configs: {0: config0},
      projections: $.makeProjectionRegistry(),
   };
}
clsDerivedProjection ::= ({
   name: 'projection.derived',
   projection: true,
   'projection.derived': true
})
makeProjection ::= function (rel, rkey, bindings) {
   $.check(Object.keys(bindings).length === 0);
   $.check(rkey === undefined);

   // let config = $.configFor(rel, boundAttrs);
   let config = rel.config0;

   let subs = Array.from(rel.subsProducer(rkey, bindings));

   let subIndexInstances = Array.from(
      config.appliedIndices,
      ({projNum, index}) => $.refIndexInstance(subs[projNum].proj, index)
   );

   let proj = {
      class: $.clsDerivedProjection,
      relation: rel,
      isKeyed: rel.isKeyed,
      refCount: 0,
      regPoint: null,   // initialized by the calling code
      isValid: false,
      validRevDeps: new Set,
      config: config,
      subs: subs,
      subIndexInstances: subIndexInstances,
      myVer: null,
      records: null,  // dry in the beginning
      // forward: rkey -> [subkey, subkey, ...]
      recDeps: new Map,
      // backward: [ {subkey -> Set{rkey, rkey, ...}}, ...], numDeps in length
      subrecDeps: $.produceArray(config.numDeps, $.multimap),
      myIndexInstances: [],
   };

   $.rebuildProjection(proj);

   return proj;
}
freeProjection ::= function (proj) {
   for (let inst of proj.subIndexInstances) {
      $.releaseIndexInstance(inst);
   }

   for (let {ver: subVer, proj: subProj} of proj.subs) {
      if (subVer !== null) {
         $.releaseVersion(subVer);
      }

      subProj.validRevDeps.delete(proj);
      $.releaseProjection(subProj);
   }
}
markProjectionValid ::= function (proj) {
   for (let {proj: subProj} of proj.subs) {
      subProj.validRevDeps.add(proj);
   }

   proj.isValid = true;
}
configFor ::= function (rel, boundAttrs) {
   throw new Error;

   let cfgkey = $.boundAttrs2ConfigKey(rel.attrs, boundAttrs);

   if (!$.hasOwnProperty(rel.configs, cfgkey)) {
      rel.configs[cfgkey] = $.narrowConfig(rel.config0, Reflect.ownKeys(boundAttrs));
   }
   
   return rel.configs[cfgkey];
}
boundAttrs2ConfigKey ::= function (attrs, boundAttrs) {
   throw new Error;

   let cfgkey = 0;

   for (let i = 0; i < attrs.length; i += 1) {
      if ($.hasOwnProperty(boundAttrs, attrs[i])) {
         cfgkey |= (1 << i);
      }
   }

   return cfgkey;
}
rebuildProjection ::= function (proj) {
   $.check(proj.myVer === null, `Cannot rebuild projection which is being referred to`);

   let {relation: rel, config} = proj;

   for (let {proj: subProj} of proj.subs) {
      $.gUpdateProjection(subProj);
   }

   for (let sub of proj.subs) {
      // First create a new version, then release a reference to the old version.
      // This ensures that when there's only 1 version for the 'subProjs[i]', we don't
      // re-create the version object.
      let newVer = $.refCurrentState(sub.proj);
      if (sub.ver !== null) {
         $.releaseVersion(sub.ver);
      }
      sub.ver = newVer;
   }

   let ns = Object.fromEntries($.map(config.lvars, lvar => [lvar, undefined]));
   
   // // In case if proj is keyed, we need 'recKey' and probably 'recVal' in 'ns' anyways,
   // // even if any of them is bound. That's different form plain attributes which can
   // // be omitted if bound.
   // if (proj.isKeyed) {
   //    if ($.hasOwnProperty(proj.boundAttrs, $.recKey)) {
   //       ns[$.recKey] = proj.boundAttrs[$.recKey];
   //    }
      
   //    if (proj.recType === $.RecordType.keyVal && $.hasOwnProperty(proj.boundAttrs, $.recVal)) {
   //       ns[$.recVal] = proj.boundAttrs[$.recVal];
   //    }
   // }

   let subKeys = new Array(config.numDeps).fill(null);

   let sub0 = $.minimumBy(proj.subs, ({proj: subProj}) => $.projectionSize(subProj));

   $.check(sub0 !== undefined);

   let plan0 = config.plan[proj.subs.indexOf(sub0)];
   
   proj.records = new (proj.isKeyed ? $.RecordMap : $.RecordSet)();

   for (let rec of $.projectionRecords(sub0.proj)) {
      let [rkey, rval] = sub0.proj.isKeyed ? rec : [rec, rec];

      if (plan0.rkeyLvar !== null) {
         ns[plan0.rkeyLvar] = rkey;
      }

      for (let [attr, lvar] of plan0.start) {
         ns[lvar] = rval[attr];
      }

      subKeys[sub0.depNum] = rkey;
      run(plan0.joinTree);
      subKeys[sub0.depNum] = null;
   }
  
   $.markProjectionValid(proj);

   function run(jnode) {
      if (jnode === null) {
         let rec = $.makeRecordFor(proj, ns);
         let rkey = proj.isKeyed ? rec[0] : rec;

         proj.records.addRecord(rec);
         $.recDep(proj, rkey, subKeys);

         for (let inst of proj.myIndexInstances) {
            $.indexAdd(inst, rec);
         }

         // No need to adjust myVer because it's null at this point

         return;
      }
      
      if (jnode.class === $.clsJoinEither) {
         for (let branch of jnode.branches) {
            run(branch);
         }

         return;
      }

      if (jnode.class === $.clsJoinFunc) {
         throw new Error;

         for (let _ of $.joinFuncRel(proj, jnode, ns)) {
            run(jnode.next);
         }

         return;
      }

      let {proj: subProj, depNum} = proj.subs[jnode.projNum];

      outer:
      for (let subrec of $.joinRecords(proj, jnode, ns)) {
         let [subkey, subval] = proj.isKeyed ? subrec : [subrec, subrec];

         for (let [attr, lvar] of jnode.checkAttrs) {
            if (subval[attr] !== ns[lvar]) {
               continue outer;
            }
         }

         for (let [attr, lvar] of jnode.extractAttrs) {
            ns[lvar] = subval[attr];
         }

         if (jnode.extractRkeyInto !== null) {
            ns[jnode.extractRkeyInto] = subkey;
         }

         subKeys[depNum] = subkey;
         run(jnode.next);
         subKeys[depNum] = null;
      }
   }
}
updateProjection ::= function (proj) {
   throw new Error;

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
            let rec = proj.recAt(rkey);

            proj.records.delete(rkey);

            if (proj.myVer !== null) {
               $.versionRemove(proj.myVer, rec);
            }

            for (let idxInst of proj.myIndexInstances) {
               $.indexRemove(idxInst, rec);
            }
         }
      }
   }

   // projNum => ver.added
   let subNum2Added = new Map;

   for (let [i, subVer] of $.enumerate(proj.subVers)) {
      if ($.isVersionFresh(subVer)) {
         continue;
      }

      $.unchainVersion(subVer);

      if (subVer.removed.size > 0) {
         removeForSubkeyRemoval(i, subVer.removed);
      }
      if (subVer.added.size > 0) {
         subNum2Added.set(i, subVer.added);
      }
   }

   // Add
   let {config} = proj;
   let ns = Object.fromEntries($.map(config.lvars, lvar => [lvar, undefined]));

   // In case if proj is keyed, we need 'recKey' and probably 'recVal' anyways, even
   // if any of them is bound. That's different from plain attributes that can safely
   // be omitted from the record object if bound.
   if (proj.isKeyed) {
      if ($.hasOwnProperty(proj.boundAttrs, $.recKey)) {
         ns[$.recKey] = proj.boundAttrs[$.recKey];
      }
      
      if (proj.recType === $.RecordType.keyVal && $.hasOwnProperty(proj.boundAttrs, $.recVal)) {
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

            proj.addRecord(rec);
            $.recDep(proj, proj.recKey(rec), subKeys);

            for (let idxInst of proj.myIndexInstances) {
               $.indexAdd(idxInst, rec);
            }

            if (proj.myVer !== null) {
               $.versionAdd(proj.myVer, rec);
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
            jnode.projNum < dsubNum && subNum2Added.get(jnode.projNum) || null
         );

         outer:
         for (let subRec of $.joinRecords(proj, jnode, ns)) {
            let subKey = subProj.recKey(subRec);

            if (keysToExclude !== null && keysToExclude.has(subKey)) {
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
         let subRec = dsubProj.recAt(subKey);

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
      let subVer = proj.subVers[i];

      if (!$.isVersionFresh(subVer)) {
         proj.subVers[i] = $.refCurrentState(proj.subProjs[i]);
         $.releaseVersion(subVer);
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
   let {class: cls, projNum} = jnode;
   let {proj: subProj} = proj.subs[projNum];
   
   if (cls === $.clsJoinAll) {
      return subProj.records;
   }

   if (cls === $.clsJoinRecKey) {
      let rec = subProj.records.recordAt(ns[jnode.rkeyLvar]);
      return rec !== undefined ? [rec] : [];
   }

   if (cls === $.clsJoinIndex) {
      let {indexNum, indexKeys} = jnode;

      return $.indexRef(
         proj.subIndexInstances[indexNum], $.map(indexKeys, lvar => ns[lvar])
      );
   }

   throw new Error(`Cannot handle this join type here: ${type}`);
}
makeRecordFor ::= function (proj, ns) {
   if (proj.isKeyed) {
      if (proj.config.attrs.length === 0) {
         return [ns[$.recKey], ns[$.recVal]];
      }
      else {
         return [
            ns[$.recKey],
            Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]))
         ];
      }
   }
   else {
      return Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));
   }
}
recDep ::= function (proj, rkey, subKeys) {
   subKeys = Array.from(subKeys);
   proj.recDeps.set(rkey, subKeys);

   for (let [mmap, subKey] of $.zip(proj.subrecDeps, subKeys)) {
      $.mmapAdd(mmap, subKey, rkey);
   }
}
subrecUndep ::= function (proj, depNum, subKey) {
   // We need to make a copy because this set is going to be modified inside the loop
   let rkeys = Array.from(proj.subrecDeps[depNum].get(subKey) ?? []);

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
