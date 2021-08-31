common
   arraysEqual
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
prolog-shared
   recAttr
   recKey
   recVal
prolog-projection
   projectionFor
   releaseProjection
   updateProjection as: gUpdateProjection
   makeRecords
prolog-conjunct
   * as: conjunct
prolog-version
   refCurrentState
   releaseVersion
   isVersionUpToDate
   unchainVersions
prolog-index
   copyIndex
   isIndexCovered
   indexAdd
   indexRemove
   indexAt
prolog-index-instance
   refIndexInstance
   releaseIndexInstance
prolog-update-scheme
   computeIncrementalUpdateScheme
   narrowConfig
-----
MAX_REL_ATTRS ::= 30
derivedRelation ::= function ({
   name: relname,
   hasNaturalIdentity=false,
   attrs=[],
   indices=[],
   body: bodyCallback
}) {
   $.check(attrs.length <= $.MAX_REL_ATTRS,
      () => `Relation '${relname}': too many attributes`
   );
   $.check(attrs.length > 0 || hasNaturalIdentity,
      `Attrs can only be omitted for relations with natural identity`
   );

   let lvname = Symbol('lvar');
   let vpool = new Map;

   function getvar(name) {
      if (!vpool.has(name)) {
         vpool.set(name, {
            [lvname]: name,
         });
      }

      return vpool.get(name);    
   }

   let body = bodyCallback(
      Object.assign(function (strings) {
         if (strings.length !== 1) {
            throw new Error(`Logical variable names don't support inline expressions`);
         }

         let [name] = strings;

         return getvar(name);
      }, {
         key: $.recKey,
         val: $.recVal
      })
   );
   
   // Ensure the implicit lvars that correspond to the attrs are in the pool. If they are
   // not by now, this is an error that will be detected later.
   for (let attr of attrs) {
      getvar(attr);
   }

   for (let {rel, attrs: cjAttrs} of body) {
      let missingAttrs = Object.keys(cjAttrs).filter(a => !rel.attrs.includes(a));

      $.check(missingAttrs.length === 0, () =>
         `Relation '${relname}': missing attrs in conjunct '${rel.name}': ` +
         `${$.singleQuoteJoinComma(missingAttrs)}`
      );

      if (rel.isKeyed) {
         if ($.hasOwnProperty(cjAttrs, $.recVal)) {
            $.check($.hasNoEnumerableProps(cjAttrs), () =>
               `Relation '${relname}': both 'v.val' and ordinary attribute(s) were ` +
               `used in the conjunct '${rel.name}'`
            )
         }
      }
      else {
         $.check(
            !$.hasOwnProperty(cjAttrs, $.recKey) && !$.hasOwnProperty(cjAttrs, $.recVal),
            () => `Relation '${relname}': v.key or v.val used in conjunct ` +
            `'${rel.name}' which does not have natural identity`
         );
      }
   }

   let conjs = Array.from(body, spec => $.conjunct.fromSpec(spec, lvname));

   // Give all the conjuncts numbers from 0 to N-1
   for (let i = 0; i < conjs.length; i += 1) {
      conjs[i].num = i;
   }

   for (let conj of conjs) {
      let dupVar = $.conjunct.duplicateVarIn(conj);

      $.check(dupVar === null, () =>
         `Relation '${relname}': duplicate var '${dupVar}' in conjunct ` +
         `'${conj.rel.name}'`
      );
   }

   let lvars = Array.from(vpool.keys());

   {
      let {met, unmet} = $.conjunct.varUsageSanity(lvars, attrs, conjs);

      $.check(unmet.size === 0, () =>
         `Relation '${relname}': lvars not used anywhere: ${$.singleQuoteJoinComma(unmet)}`
      );

      $.check(met.size === 0, () =>
         `Relation '${relname}': lvars mentioned once but otherwise not used: ` +
         `${$.singleQuoteJoinComma(met)}`
      );
   }
   
   let {jpaths, appliedIndices} = $.computeIncrementalUpdateScheme(relname, conjs);
   let config0 = {
      conjs: conjs,
      attrs: attrs,
      lvars: lvars,
      jpaths: jpaths,
      appliedIndices: appliedIndices,
   };

   return {
      isBase: false,
      isKeyed: hasNaturalIdentity,
      name: relname,
      attrs: attrs,
      indices: indices,
      config0: config0,
      configs: {0: config0},
      projmap: new Map,
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
      index => $.refIndexInstance(subProjs[index.forConj.num], index)
   );

   let proj = {
      rel: rel,
      refcount: 0,
      isValid: false,
      isKeyed: rel.isKeyed,
      boundAttrs: boundAttrs,
      config: config,
      subProjs: subProjs,
      subVers: subVers,
      subIndexInstances: subIndexInstances,
      myVer: null,
      records: null,  // lean in the beginning
      recDeps: new Map,
      indexInstances: [],
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
      rel.configs[cfgkey] = $.narrowConfig(rel.configs[0], boundAttrs);
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
   $.check(!proj.isKeyed, `Not impl`);

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
   let subKeys = [];

   function run(k) {
      if (k === jpath0.length) {
         let rec = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

         // TODO: for now 'rec' is always the key (because 'proj' is non-keyed)
         $.recDep(proj.recDeps, rec, subKeys);
         proj.records.add(rec);

         return;
      }

      let {conj, index, indexLvars, checkAttrs, extractAttrs} = jpath0[k];
      let subProj = proj.subProjs[conj.num];
      let records;

      if (index === null) {
         records = subProj.records;
      }
      else {
         let rkeys = $.indexAt(
            proj.subIndexInstances[index.num],
            Array.from(indexLvars, lvar => ns[lvar])
         );
         
         if (subProj.isKeyed) {
            records = $.map(rkeys, rkey => subProj.records.getEntry(rkey));
         }
         else {
            records = rkeys;
         }
      }
      
      outer:
      for (let rec of records) {
         for (let [attr, lvar] of checkAttrs) {
            if ($.recAttr(rec, attr, subProj.isKeyed) !== ns[lvar]) {
               continue outer;
            }
         }

         for (let [attr, lvar] of extractAttrs) {
            ns[lvar] = $.recAttr(rec, attr, subProj.isKeyed);
         }

         subKeys.push(subProj.isKeyed ? rec[0] : rec);
         run(k + 1);
         subKeys.pop();
      }
   }

   proj.records = $.makeRecords([], proj.isKeyed);
   proj.records.owner = proj;

   for (let rec of subproj0.records) {
      for (let [attr, lvar] of conj0.looseAttrs) {
         ns[lvar] = $.recAttr(rec, attr, subproj0.isKeyed);
      }

      subKeys.push(subproj0.isKeyed ? rec[0] : rec);
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

   // subDeltas: conj => delta
   let subDeltas = new Map(
      $.mapfilter(proj.config.conjs, conj => {
         let subVer = proj.subVers[conj.num];
         if (!$.isVersionUpToDate(subVer)) {
            $.unchainVersions(subVer);
            return [conj, subVer.delta];
         }
      })
   );

   // Remove
   let delta = proj.myVer !== null ? proj.myVer.delta : null;

   for (let [conj, subDelta] of subDeltas) {
      for (let [subRec, action] of subDelta) {
         if (action === 'remove') {
            let tuples = $.undepSubtuple(proj.tupleDeps, subRec);

            for (let tuple of tuples) {
               proj.value.delete(tuple);
            }

            if (delta !== null) {
               for (let tuple of tuples) {
                  $.deltaAdd(delta, tuple, 'remove');
               }
            }

            for (let idxInst of proj.indexInstances) {
               for (let tuple of tuples) {
                  $.indexRemove(idxInst, tuple);
               }
            }
         }
      }
   }

   // Add
   for (let [dconj, subDelta] of subDeltas) {
      let jpath = proj.config.jpaths[dconj.num];

      let ns = Object.fromEntries(
         $.map($.conjunct.lvarsIn(dconj), lvar => [lvar, undefined])
      );
      let subTuples = [];

      function run(k) {
         if (k === jpath.length) {
            let tuple = Object.fromEntries($.map(proj.config.attrs, a => [a, ns[a]]));

            $.depTuple(proj.tupleDeps, tuple, subTuples);

            proj.value.add(tuple);

            if (delta !== null) {
               $.deltaAdd(delta, tuple, 'add');
            }

            for (let idxInst of proj.indexInstances) {
               $.indexAdd(idxInst, tuple);
            }

            return;
         }

         let {conj, index, checkAttrs, extractAttrs} = jpath[k];
         let source;

         if (index === null) {
            source = proj.subProjs[conj.num].value;
         }
         else {
            source = $.indexMultiAt(
               proj.subIndexInstances[index.num], attr => ns[conj.looseAttrs[attr]]
            );
         }

         // noDelta is used to exclude tuples that belong to deltas of already-processed
         // conjuncts (as we process in order, an already processed is the one with lesser
         // number)
         let noDelta = conj.num < dconj.num ? subDeltas.get(conj) || null : null;
         
         outer:
         for (let tuple of source) {
            if (noDelta !== null && noDelta.has(tuple)) {
               continue;
            }

            for (let attr of checkAttrs) {
               let lvar = conj.looseAttrs[attr];
               if (tuple[attr] !== ns[lvar]) {
                  continue outer;
               }
            }

            for (let attr of extractAttrs) {
               let lvar = conj.looseAttrs[attr];
               ns[lvar] = tuple[attr];
            }

            subTuples.push(tuple);
            run(k + 1);
            subTuples.pop();
         }
      }

      for (let [subTuple, action] of subDelta) {
         if (action === 'add') {
            for (let [attr, lvar] of Object.entries(dconj.looseAttrs)) {
               ns[lvar] = subTuple[attr];
            }
            
            subTuples.push(subTuple);
            run(0);
            subTuples.pop();
         }
      }
   }

   // Finally ref new sub versions
   for (let conj of subDeltas.keys()) {
      let newVer = $.refCurrentState(proj.subProjs[conj.num]);
      $.releaseVersion(proj.subVers[conj.num]);
      proj.subVers[conj.num] = newVer;
   }

   $.markProjectionValid(proj);
}
recDep ::= function (deps, rec, subs) {
   subs = Array.from(subs);
   deps.set(rec, subs);

   for (let sub of subs) {
      $.setDefault(deps, sub, () => new Set).add(rec);
   }
}
subRecUndep ::= function (deps, sub) {
   // We need to make a copy because this set is going to be modified inside the loop
   let recs = Array.from(deps.get(sub) || []);

   if (recs.length === 0) {
      return [];
   }

   for (let rec of recs) {
      $.recUndep(deps, rec);
   }

   return recs;
}
recUndep ::= function (deps, rec) {
   let subs = deps.get(rec);

   for (let sub of subs) {
      let tset = deps.get(sub);

      tset.delete(rec);

      if (tset.size === 0) {
         deps.delete(sub);
      }
   }

   deps.delete(rec);
}
