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
prolog-shared
   plainAttrs
   recKey
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
   indexOn
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
         if (jplink.type !== $.JoinLinkType.indexed) {
            continue;
         }

         jplink.index = $.addToIndexRegistry(reg, jplink.conjNum, jplink.index, () => {
            return Object.assign($.copyIndex(jplink.index), {forConjNum: jplink.conjNum});
         });
      }
   }

   let appliedIndices = reg.flat();

   jpaths = $.joinPathsWithIndexNums(jpaths, appliedIndices);

   return {jpaths, appliedIndices};
}
JoinLinkType ::= ({
   all: 'all',
   indexed: 'indexed',
   pk: 'pk'
})
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

      jpath.push($.makeJplink(Xff, Xindex));
      unjoined.delete(Xff);
      bindLvars(Xff.freeLvars);
   }

   return jpath;
}
makeJplink ::= function (cjff, index) {
   if (index === null) {
      return {
         type: $.JoinLinkType.all,
         conjNum: cjff.conj.num,
         checkAttrs: $.cjffCheckAttrs(cjff, null),
         extractAttrs: $.cjffExtractAttrs(cjff),
      }
   }
   else if ($.arraysEqual(index, [$.recKey])) {
      return {
         type: $.JoinLinkType.pk,
         conjNum: cjff.conj.num,
         pkLvar: cjff.conj.looseAttrs.get($.recKey),
         checkAttrs: $.cjffCheckAttrs(cjff, index),
         extractAttrs: $.cjffExtractAttrs(cjff)
      }
   }
   else {
      return {
         type: $.JoinLinkType.indexed,
         conjNum: cjff.conj.num,
         index: index,  // will be replaced with 'indexNum' later
         indexLvars: Array.from(index, attr => cjff.conj.looseAttrs.get(attr)),
         checkAttrs: $.cjffCheckAttrs(cjff, index),
         extractAttrs: $.cjffExtractAttrs(cjff)
      }
   }
}
makeConjunctFulfillment ::= function (conj) {
   let idxffs = Array.from(conj.indices, $.makeIndexFulfillment);

   if (conj.rel.keyed !== false) {
      // This is implied/artificial unique index
      let pk = $.indexOn([$.recKey], {isUnique: true});
      idxffs.unshift($.makeIndexFulfillment(pk));
   }

   return {
      conj: conj,
      freeLvars: new Set($.lvarsIn(conj)),
      boundLvars: new Set,
      idxffs: idxffs
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
cjffCheckAttrs ::= function ({conj, boundLvars}, index=null) {
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
joinPathsWithIndexNums ::= function (jpaths, appliedIndices) {
   return jpaths.map(jpath => jpath.map(jplink => {
      if (jplink.type !== $.JoinLinkType.indexed) {
         return jplink;
      }

      let {index, ...newLink} = jplink;
      let indexNum = appliedIndices.indexOf(index);

      $.assert(() => indexNum !== -1);

      newLink.indexNum = indexNum;
      return newLink;
   }));
}
narrowConfig ::= function (config0, boundAttrs) {
   let n_conjs = Array.from(config0.conjs, conj => $.reduceConj(conj, boundAttrs));
   let reg = $.makeIndexRegistryPerConj(config0.conjs.length);
   let n_jpaths = config0.jpaths.map(jpath => jpath.map(
      jplink => $.narrowJplink(jplink, config0, boundAttrs, reg)
   ));

   let appliedIndices = reg.flat();

   n_jpaths = $.joinPathsWithIndexNums(n_jpaths, appliedIndices);

   let n_config = {
      conjs: n_conjs,
      attrs: config0.attrs.filter(a => !$.hasOwnProperty(boundAttrs, a)),
      plainAttrs: null,
      lvars: config0.lvars.filter(lvar => !$.hasOwnProperty(boundAttrs, lvar)),
      jpaths: n_jpaths,
      appliedIndices,
   };

   n_config.plainAttrs = $.plainAttrs(n_config.attrs);

   return n_config;
}
narrowJplink ::= function (jplink, config0, boundAttrs, indexRegistry) {
   let {type, conjNum, checkAttrs, extractAttrs} = jplink;

   let n_checkAttrs = $.narrowAttrList(checkAttrs, boundAttrs);
   let n_extractAttrs = $.narrowAttrList(extractAttrs, boundAttrs);

   if (type === $.JoinLinkType.all) {
      return {
         type,
         conjNum,
         checkAttrs: n_checkAttrs,
         extractAttrs: n_extractAttrs,
      }
   }
   else if (type === $.JoinLinkType.pk) {
      let {pkLvar} = jplink;

      if ($.hasOwnProperty(boundAttrs, pkLvar)) {
         return {
            type: $.JoinLinkType.all,
            conjNum,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
      else {
         return {
            type: $.JoinLinkType.pk,
            conjNum,
            pkLvar,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs
         }
      }
   }
   else {
      $.assert(() => type === $.JoinLinkType.indexed);

      let {indexNum} = jplink;
      let conj = config0.conjs[conjNum];
      let n_index = $.reduceConjIndex(conj, config0.appliedIndices[indexNum], boundAttrs);

      if ($.isIndexCovered(n_index)) {
         return {
            type: $.JoinLinkType.all,
            conjNum,
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
      else {
         n_index = $.addToIndexRegistry(indexRegistry, conjNum, n_index, () => {
            n_index.forConjNum = conjNum;
            return n_index;
         });

         return {
            type: $.JoinLinkType.indexed,
            conjNum,
            index: n_index,  // will be replaced with 'indexNum'
            indexLvars: Array.from(n_index, attr => conj.looseAttrs.get(attr)),
            checkAttrs: n_checkAttrs,
            extractAttrs: n_extractAttrs,
         }
      }
   }
}
narrowAttrList ::= function (attrList, boundAttrs) {
   return attrList.filter(([attr, lvar]) => !$.hasOwnProperty(boundAttrs, lvar));
}
