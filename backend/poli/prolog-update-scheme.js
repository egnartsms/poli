common
   any
   assert
   arraysEqual
   check
   enumerate
   find
   filter
   hasOwnProperty
   map
   mapfilter
   produceArray
   keyForValue
   zip
prolog-conjunct
   lvarsIn
   Shrunk
   reduceConjIndex
   reduceConj
prolog-index
   superIndexOfAnother
   copyIndex
   indexBindAttr
   isIndexCovered
-----
visualizeIncrementalUpdateScheme ::= function (rel) {
   function* gen(dconj, jpath) {
      yield `D(${dconj.rel.name})`;
      for (let link of jpath) {
         yield ` -> ${link.conj.rel.name}(${link.index.join(', ')})`;
         if (link.checkAttrs.length > 0) {
            yield ` checking (${link.checkAttrs.join(', ')})`;
         }
         if (link.extractAttrs.length > 0) {
            yield ` getting (${link.extractAttrs.join(', ')})`;
         }
      }
      yield '\n';
   }

   for (let [num, jpath] of $.enumerate(rel.config0.jpaths)) {
      let dconj = rel.config0.conjs[num];

      console.log(Array.from(gen(dconj, jpath)).join(''));
   }
}
computeIncrementalUpdateScheme ::= function (relname, conjs) {
   let jpaths = $.produceArray(
      conjs.length,
      i => $.joinPathForDelta(relname, conjs, conjs[i])
   );
   let reg = $.makeIndexRegistryPerConj(conjs.length);

   for (let jpath of jpaths) {
      for (let jplink of jpath) {
         if (jplink.index === null) {
            continue;
         }

         jplink.index = $.addToIndexRegistry(reg, jplink.conjNum, jplink.index, () => {
            return Object.assign($.copyIndex(jplink.index), {forConjNum: jplink.conjNum});
         });
      }
   }

   let appliedIndices = reg.flat();

   $.replaceIndexWithNumInJoinPaths(jpaths, appliedIndices);

   return {jpaths, appliedIndices};
}
makeIndexRegistryPerConj ::= function (numConjs) {
   // Index registry per conj is: [[idx00, idx01, ...], [idx10, idx11, ...], ...]
   // (list of indices per respective conjunct)
   return $.produceArray(numConjs, () => []);
}
addToIndexRegistry ::= function (reg, numConj, index, ifmissing) {
   let existing = $.find(reg[numConj], idx => $.arraysEqual(idx, index));

   if (existing === undefined) {
      existing = ifmissing();
      reg[numConj].push(existing);
   }

   return existing;
}
replaceIndexWithNumInJoinPaths ::= function (jpaths, appliedIndices) {
   for (let jpath of jpaths) {
      for (let jplink of jpath) {
         if (jplink.index === null) {
            jplink.indexNum = null;
         }
         else {
            jplink.indexNum = appliedIndices.indexOf(jplink.index);
            $.assert(() => jplink.indexNum !== -1);
         }
         
         delete jplink.index;
      }
   }
}
joinPathForDelta ::= function (relname, conjs, dconj) {
   let unjoined = new Set($.mapfilter(conjs, conj => {
      if (conj !== dconj) {
         return $.makeConjunctFulfillment(conj);
      }
   }));

   function bindLvars(lvars) {
      for (let cjff of unjoined) {
         $.cjffBindLvars(cjff, lvars);
      }
   }

   bindLvars($.lvarsIn(dconj));

   let jpath = [];

   while (unjoined.size > 0) {
      let Xff = null;
      let Xindex = null;

      // Take first from 'unjoined' that we can join
      for (let cjff of unjoined) {
         let usableIndices = cjff.idxffs.filter($.isIndexCovered);
         
         if (usableIndices.length === 0) {
            continue;
         }

         let unique = usableIndices.find(idx => idx.original.isUnique);
         if (unique !== undefined) {
            Xff = cjff;
            Xindex = unique.original;
            break;
         }
         
         if (Xff === null) {
            Xff = cjff;
            Xindex = usableIndices[0].original;
         }
      }

      if (Xff === null) {
         // Some conjunct may be already shrunk by some index due to firmAttrs. For these
         // conjuncts, we can join them without any index.
         Xff = $.find(unjoined, ({conj}) => conj.shrunk > $.Shrunk.no);

         if (Xff === undefined) {
            throw new Error(
               `Relation '${relname}': cannot build join path from '${dconj.rel.name}'`
            );
         }
      }

      jpath.push({
         conjNum: Xff.conj.num,
         index: Xindex,  // will be replaced with 'indexNum'
         indexLvars: Xindex === null ? null :
            Array.from(Xindex, attr => Xff.conj.looseAttrs.get(attr)),
         checkAttrs: $.cjffCheckAttrs(Xff, Xindex),
         extractAttrs: $.cjffExtractAttrs(Xff)
      });

      unjoined.delete(Xff);
      bindLvars(Xff.freeLvars);
   }

   return jpath;
}
makeConjunctFulfillment ::= function (conj) {
   return {
      conj: conj,
      freeLvars: new Set($.lvarsIn(conj)),
      boundLvars: new Set,
      idxffs: Array.from(conj.indices, $.makeIndexFulfillment)
   }
}
makeIndexFulfillment ::= function (index) {
   return Object.assign(Array.from(index), {original: index});
}
cjffBindLvars ::= function (cjff, lvars) {
   let {conj, freeLvars, boundLvars, idxffs} = cjff;

   for (let lvar of lvars) {
      if (!freeLvars.has(lvar)) {
         continue;
      }

      let attr = conj.looseAttrs.getKey(lvar);

      for (let idxff of idxffs) {
         $.indexBindAttr(idxff, attr);
      }

      freeLvars.delete(lvar);
      boundLvars.add(lvar);      
   }
}
cjffCheckAttrs ::= function ({conj, boundLvars}, index) {
   return Array.from(
      $.mapfilter(boundLvars, lvar => {
         let attr = conj.looseAttrs.getKey(lvar);

         if (index === null || !index.includes(attr)) {
            return [attr, lvar];
         }
      })
   );
}
cjffExtractAttrs ::= function ({conj, freeLvars}) {
   return Array.from(freeLvars, lvar => [conj.looseAttrs.getKey(lvar), lvar]);
}
narrowConfig ::= function (config, boundAttrs) {
   let n_conjs = Array.from(config.conjs, conj => $.reduceConj(conj, boundAttrs));
   let n_jpaths = [];
   let reg = $.makeIndexRegistryPerConj(config.conjs.length);

   for (let jpath of config.jpaths) {
      let n_jpath = [];

      for (let {conjNum, indexNum, indexLvars, checkAttrs, extractAttrs} of jpath) {
         let n_index = $.reduceConjIndex(
            config.appliedIndices[indexNum], config.conjs[conjNum], boundAttrs
         );

         if ($.isIndexCovered(n_index)) {
            n_index = null;
         }
         else {
            n_index = $.addToIndexRegistry(reg, conjNum, n_index, () => {
               n_index.forConjNum = conjNum;
               return n_index;
            });
         }

         n_jpath.push({
            conjNum,
            index: n_index,  // will be replaced with 'indexNum'
            indexLvars: n_index === null ? null :
               indexLvars.filter(lv => !$.hasOwnProperty(boundAttrs, lv)),
            checkAttrs: $.narrowAttrList(checkAttrs, boundAttrs),
            extractAttrs: $.narrowAttrList(extractAttrs, boundAttrs),
         });
      }

      n_jpaths.push(n_jpath);
   }

   let appliedIndices = reg.flat();

   $.replaceIndexWithNumInJoinPaths(n_jpaths, appliedIndices);

   return {
      conjs: n_conjs,
      attrs: config.attrs.filter(a => !$.hasOwnProperty(boundAttrs, a)),
      lvars: config.lvars.filter(lvar => !$.hasOwnProperty(boundAttrs, lvar)),
      jpaths: n_jpaths,
      appliedIndices
   }
}
narrowAttrList ::= function (attrList, boundAttrs) {
   return attrList.filter(([attr, lvar]) => !$.hasOwnProperty(boundAttrs, lvar));
}
