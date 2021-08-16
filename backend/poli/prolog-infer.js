common
   areArraysEqual
   assert
   hasOwnProperty
   commonArrayPrefixLength
   find
   isObjectWithOwnProperty
   singleQuoteJoinComma
   map
   mapfilter
   filter
prolog-index
   superIndexOfAnother
   copyIndex
   indexBindAttr
   isIndexCovered
-----
inferredRelation ::= function (callback) {
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

   let relspec = callback(function (strings) {
      if (strings.length !== 1) {
         throw new Error(`Logical variable names don't support inline expressions`);
      }

      let [name] = strings;

      return getvar(name);
   });

   // Ensure the implicit lvars that correspond to the attrs are in the pool. If they are
   // not by now, this is an error anyways, but we still want them to be in the vpool.
   for (let attr of relspec.attrs) {
      getvar(attr);
   }

   for (let conjspec of relspec.body) {
      let invalidAttrs = $.conjunctSpecInvalidAttrs(conjspec);

      if (invalidAttrs.length > 0) {
         throw new Error(
            `Relation '${relspec.name}': missing attr(s) ` +
            `${$.singleQuoteJoinComma(invalidAttrs)} in conjunct '${conjspec.rel.name}'`
         );
      }
   }

   let body = Array.from(relspec.body, conjspec => $.conjunctFromSpec(conjspec, lvname));

   for (let conj of body) {
      let dupVar = $.conjunctDuplicateVar(conj);

      if (dupVar !== null) {
         throw new Error(
            `Relation '${relspec.name}': duplicate var '${dupVar}' in conjunct ` +
            `'${conj.rel.name}'`
         );
      }
   }

   let lvars = Array.from(vpool.keys());

   {
      let {met, unmet} = $.varUsageSanity(lvars, relspec.attrs, body);

      if (unmet.size > 0) {
         let names = $.singleQuoteJoinComma(unmet);
         throw new Error(`Relation '${relspec.name}': lvars not used anywhere: ${names}`);
      }

      if (met.size > 0) {
         let names = $.singleQuoteJoinComma(met);
         throw new Error(
            `Relation '${relspec.name}': lvars mentioned once but otherwise not used: ${names}`
         );
      }
   }
   
   let cfg0 = new Map(
      $.map(body, conj => ({
         jplinks: [],
         jpath: []
      }))
   );

   $.assert(relspec.indices === undefined);

   return {
      isFactual: false,
      name: relspec.name,
      attrs: relspec.attrs,
      lvars: lvars,
      body: body,
      indices: [],  // TODO: implement indices
      scheme0: $.computeIncrementalUpdateScheme(relspec.name, body),
      projmap: new Map,
      projs: new Set,
      validProjs: new Set
   };
}
conjunctSpecInvalidAttrs ::= function ({attrs, rel}) {
   return Object.keys(attrs).filter(a => !rel.attrs.includes(a));
}
conjunctFromSpec ::= function ({attrs, rel}, lvname) {
   function isLvar(obj) {
      return $.isObjectWithOwnProperty(obj, lvname);
   }

   let firmAttrs = new Map(
      $.filter(Object.entries(attrs), ([attr, val]) => !isLvar(val))
   );
   let looseAttrs = new Map(
      $.mapfilter(Object.entries(attrs), ([attr, lvar]) => {
         if (isLvar(lvar)) {
            return [attr, lvar[lvname]];
         }
      })
   );

   let indices = Array.from(rel.indices, $.copyIndex);
   for (let attr of firmAttrs.keys()) {
      for (let index of indices) {
         $.indexBindAttr(index, attr);
      }
   }

   let shrunk = 
      indices.find(idx => $.isIndexCovered(idx) && idx.isUnique) ? 'scalar' :
      indices.find(idx => $.isIndexCovered(idx)) ? 'index' :
      'no';

   indices = indices.filter(idx => !$.isIndexCovered(idx));

   return {
      rel,
      firmAttrs,
      looseAttrs,
      lvars: new Map($.map(looseAttrs, ([attr, lvar]) => [lvar, attr])),
      indices,
      shrunk
   }
}
conjunctDuplicateVar ::= function (conj) {
   let lvars = new Set;

   for (let lvar of conj.looseAttrs.values()) {
      if (lvars.has(lvar)) {
         return lvar;
      }
      
      lvars.add(lvar);
   }

   return null;
}
varUsageSanity ::= function (lvars, attrs, body) {
   let unmet = new Set(lvars);
   let met = new Set;
   let used = new Set;

   function meet(lvar) {
      if (unmet.has(lvar)) {
         unmet.delete(lvar);
         met.add(lvar);
      }
      else if (met.has(lvar)) {
         met.delete(lvar);
         used.add(lvar);
      }
   }

   for (let lvar of attrs) {
      meet(lvar);
   }

   for (let conj of body) {
      for (let lvar of conj.looseAttrs.values()) {
         meet(lvar);
      }
   }

   return {unmet, met};
}
visualizeIncrementalUpdateScheme ::= function (rel) {
   console.log(
      "Number of j.p. links:",
      Array.from(rel.body, conj => conj.joinPathLinks.length).reduce((a, b) => a + b)
   );

   function* gen(dconj, path) {
      yield `D(${dconj.rel.name})`;
      for (let link of path) {
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

   for (let [dconj, path] of rel.updateScheme) {
      console.log(Array.from(gen(dconj, path)).join(''));
   }
}
computeIncrementalUpdateScheme ::= function (relname, body) {
   let scheme0 = {
      slots: [],
      forConj: new Map($.map(body, conj => [conj, {
         jplinks: [],
         jpath: null,
         slots: []
      }]))
   };

   for (let dconj of body) {
      let jpath = $.joinPathForDelta(relname, dconj, body, scheme0.forConj);

      scheme0.forConj.get(dconj).jpath = jpath;
   }

   $.renumerateSlots(body, scheme0);
   
   return scheme0;
}
joinPathForDelta ::= function (relname, dconj, body, forConj) {
   let unjoined = new Set($.mapfilter(body, conj => {
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

   bindLvars(dconj.lvars.keys());

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
         Xff = $.find(unjoined, ({shrunk}) => shrunk === 'index' || shrunk === 'scalar');

         if (Xff === undefined) {
            throw new Error(
               `Relation '${relname}': cannot build join path from '${dconj.rel.name}'`
            );
         }
      }

      jpath.push(
         $.internJoinPathLink(Xff.conj, forConj.get(Xff.conj), {
            index: Xindex,
            checkAttrs: $.cjffCheckAttrs(Xff, Xindex),
            extractAttrs: $.cjffExtractAttrs(Xff)
         })
      );

      unjoined.delete(Xff);
      bindLvars(Xff.freeLvars);
   }

   return jpath;
}
makeConjunctFulfillment ::= function (conj) {
   return {
      conj: conj,
      freeLvars: new Set(conj.looseAttrs.values()),
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

   let attr = cjff.conj.lvars.get(lvar);

   for (let idxff of cjff.idxffs) {
      $.indexBindAttr(idxff, attr);
   }

   cjff.freeLvars.delete(lvar);
   cjff.boundLvars.add(lvar);
}
cjffCheckAttrs ::= function (cjff, index) {
   let checkAttrs = [];

   for (let lvar of cjff.boundLvars) {
      let attr = cjff.conj.lvars.get(lvar);
      if (index === null || !index.includes(attr)) {
         checkAttrs.push([attr, lvar]);
      }
   }

   return checkAttrs;
}
cjffExtractAttrs ::= function (cjff) {
   let extractAttrs = [];

   for (let lvar of cjff.freeLvars) {
      let attr = cjff.conj.lvars.get(lvar);
      extractAttrs.push([attr, lvar]);
   }
   
   return extractAttrs;   
}
internJoinPathLink ::= function (conj, forConj, linkProps) {
   let jplink = $.find(forConj.jplinks, $.sameLinkPred(linkProps));

   if (jplink === undefined) {
      jplink = {
         ...linkProps,
         slot: $.internSlot(conj, forConj, linkProps.index)
      };
      forConj.jplinks.push(jplink);
   }

   return jplink;
}
internSlot ::= function (conj, forConj, index) {
   let slot = $.find(forConj.slots, slot => slot.index === index);

   if (slot === undefined) {
      slot = {
         conj: conj,
         index: index,
         num: -1
      };

      if (index === null) {
         forConj.slots.unshift(slot);
      }
      else {
         forConj.slots.push(slot);
      }
   }

   return slot;
}
sameLinkPred ::= function ({index, checkAttrs, extractAttrs}) {
   return jplink => (
      // To be precise, it's only enough to compare index && checkAttrs or
      // index && extractAttrs since their union is always equal to the set of conjunct's
      // loose attributes.
      jplink.index === index &&
      $.areArraysEqual(jplink.checkAttrs, checkAttrs, $.firstItemsEqual) &&
      $.areArraysEqual(jplink.extractAttrs, extractAttrs, $.firstItemsEqual)
   );
}
firstItemsEqual ::= function ([a0], [b0]) {
   return a0 === b0;
}
renumerateSlots ::= function (body, scheme) {
   let nslots = 0;

   scheme.slots = Array.from(function* () {
      for (let conj of body) {
         yield* scheme.forConj.get(conj).slots;
      }
   }.call(null));

   for (let slot of scheme.slots) {
      slot.num = nslots;
      nslots += 1;
   }
}
makeZeroProjection ::= function (rel) {
   let slotValues = new Array(rel.config0.length);

   for ({conj, number, target} of rel.config0) {

   }

   return {
      rel: rel,
      
      slotValues: []
   }
}