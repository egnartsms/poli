common
   any
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
   let jpaths = $.produceArray(conjs.length, () => []);

   for (let dconj of conjs) {
      jpaths[dconj.num] = $.joinPathForDelta(relname, conjs, dconj);
   }

   let reg = $.makeIndexRegistryPerConj(conjs.length);

   for (let jpath of jpaths) {
      for (let jplink of jpath) {
         if (jplink.index === null) {
            continue;
         }

         let index = $.addToIndexRegistry(reg, jplink.conj.num, jplink.index, () => {
            return Object.assign($.copyIndex(jplink.index), {forConj: jplink.conj});
         });
         jplink.index = index;
      }
   }

   $.numerateIndexRegistry(reg);

   return {
      jpaths,
      appliedIndices: reg.flat()
   };
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
numerateIndexRegistry ::= function (reg) {
   let num = 0;

   for (let idxs of reg) {
      for (let idx of idxs) {
         idx.num = num;
         num += 1;
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
         conj: Xff.conj,
         index: Xindex,
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
   let idxff = Array.from(index);
   idxff.original = index;
   return idxff;
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

      for (let {conj, index, checkAttrs, extractAttrs} of jpath) {
         let n_index = $.reduceConjIndex(index, conj, boundAttrs);

         if ($.isIndexCovered(n_index)) {
            n_index = null;
         }
         else {
            n_index = $.addToIndexRegistry(reg, conj.num, n_index, () => {
               n_index.forConj = n_conjs[conj.num];
               return n_index;
            });
         }

         let n_conj = n_conjs[conj.num];

         n_jpath.push({
            conj: n_conj,
            index: n_index,
            indexLvars: n_index === null ? null :
               Array.from(n_index, a => n_conj.looseAttrs.get(a)),
            checkAttrs: $.narrowAttrList(checkAttrs, boundAttrs),
            extractAttrs: $.narrowAttrList(extractAttrs, boundAttrs),
         });
      }

      n_jpaths.push(n_jpath);
   }

   $.numerateIndexRegistry(reg);

   return {
      conjs: n_conjs,
      attrs: config.attrs.filter(a => !$.hasOwnProperty(boundAttrs, a)),
      lvars: config.lvars.filter(lvar => !$.hasOwnProperty(boundAttrs, lvar)),
      jpaths: n_jpaths,
      appliedIndices: reg.flat()
   }
}
narrowAttrList ::= function (attrList, boundAttrs) {
   return attrList.filter(([attr, lvar]) => !$.hasOwnProperty(boundAttrs, lvar));
}
