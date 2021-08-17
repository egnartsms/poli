common
   any
   arraysEqual
   assert
   enumerate
   find
   map
   mapfilter
   produceArray
   keyForValue
prolog-conjunct
   lvarsIn
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
            yield ` checking (${link.checkAttrs.map(x => x[0]).join(', ')})`;
         }
         if (link.extractAttrs.length > 0) {
            yield ` getting (${link.extractAttrs.map(x => x[0]).join(', ')})`;
         }
      }
      yield '\n';
   }

   for (let [num, jpath] of $.enumerate(rel.jpaths)) {
      let dconj = rel.conjs[num];

      console.log(Array.from(gen(dconj, jpath)).join(''));
   }
}
computeIncrementalUpdateScheme ::= function (relname, conjs) {
   let jpaths = $.produceArray(conjs.length, () => []);

   for (let dconj of conjs) {
      jpaths[dconj.num] = $.joinPathForDelta(relname, conjs, dconj);
   }

   let appliedFor = $.produceArray(conjs.length, () => []);

   for (let jpath of jpaths) {
      for (let jplink of jpath) {
         if (jplink.index === null) {
            continue;
         }
         
         let coll = appliedFor[jplink.conj.num];
         let cindex = $.find(coll, idx => $.arraysEqual(idx, jplink.index));

         if (cindex !== undefined) {
            jplink.index = cindex;
         }
         else {
            coll.push(jplink.index);
         }
      }
   }

   let appliedIndices = [];

   for (let [numConj, coll] of $.enumerate(appliedFor)) {
      for (let idx of coll) {
         idx.numConj = numConj;
         appliedIndices.push(idx);
      }
   }

   for (let jpath of jpaths) {
      for (let jplink of jpath) {
         jplink.indexNum = appliedIndices.indexOf(jplink.index);
      }
   }

   return {jpaths, appliedIndices};
}
joinPathForDelta ::= function (relname, conjs, dconj) {
   let unjoined = new Set($.mapfilter(conjs, conj => {
      if (conj !== dconj) {
         return $.makeConjunctFulfillment(conj);
      }
   }));

   function bindLvars(lvars) {
      for (let lvar of lvars) {
         for (let cjff of unjoined) {
            $.cjffBindLvar(cjff, lvar);
         }
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
         Xff = $.find(unjoined, ({conj}) => {
            return conj.shrunk === 'index' || conj.shrunk === 'scalar';
         });

         if (Xff === undefined) {
            throw new Error(
               `Relation '${relname}': cannot build join path from '${dconj.rel.name}'`
            );
         }
      }

      jpath.push({
         conj: Xff.conj,
         index: Xindex,
         indexNum: -1,  // will set later when we have all employed indices
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
cjffBindLvar ::= function (cjff, lvar) {
   if (!cjff.freeLvars.has(lvar)) {
      return;
   }

   let attr = $.keyForValue(cjff.conj.looseAttrs, lvar);

   for (let idxff of cjff.idxffs) {
      $.indexBindAttr(idxff, attr);
   }

   cjff.freeLvars.delete(lvar);
   cjff.boundLvars.add(lvar);
}
cjffCheckAttrs ::= function (cjff, index) {
   let checkAttrs = [];

   for (let lvar of cjff.boundLvars) {
      let attr = $.keyForValue(cjff.conj.looseAttrs, lvar);
      if (index === null || !index.includes(attr)) {
         checkAttrs.push([attr, lvar]);
      }
   }

   return checkAttrs;
}
cjffExtractAttrs ::= function (cjff) {
   let extractAttrs = [];

   for (let lvar of cjff.freeLvars) {
      let attr = $.keyForValue(cjff.conj.looseAttrs, lvar);
      extractAttrs.push([attr, lvar]);
   }
   
   return extractAttrs;   
}
