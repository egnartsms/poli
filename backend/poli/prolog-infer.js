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
-----
isObjectWithProp ::= function (obj) {
   return obj != null && obj[$.lvname] !== undefined;
}
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
            `Relation '${relspec.name}': duplicate var '${dupVar}' in conjunct '${conj.rel.name}'`
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
   
   let config0 = [];

   return {
      isFactual: false,
      name: relspec.name,
      attrs: relspec.attrs,
      lvars: lvars,
      body: body,
      indices: relspec.indices || [],
      updateScheme: $.computeIncrementalUpdateScheme(relspec.name, config0, body),
      config0: config0,
      projmap: new Map,
      projs: new Set,
      validProjs: new Set,
      project0: null
   };
}
conjunctSpecInvalidAttrs ::= function ({attrs, rel}) {
   return Object.keys(attrs).filter(a => !rel.attrs.includes(a));
}
conjunctFromSpec ::= function ({attrs, rel}, lvname) {
   function isLvar(obj) {
      return $.isObjectWithOwnProperty(obj, lvname);
   }

   let firmAttrs = Object.fromEntries(
      Object.entries(attrs) .filter(([attr, val]) => !isLvar(val))
   );
   let looseAttrs = Object.fromEntries(
      $.mapfilter(Object.entries(attrs), ([attr, lvar]) => {
         if (isLvar(lvar)) {
            return [attr, lvar[lvname]];
         }
      })
   );

   let indices = Array.from(rel.indices, $.copyIndex);
   for (let attr of Object.keys(firmAttrs)) {
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
      indices,
      shrunk,
      joinPathLinks: []
   }
}
conjunctDuplicateVar ::= function (conj) {
   let lvars = new Set;

   for (let lvar of Object.values(conj.looseAttrs)) {
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
      for (let lvar of Object.values(conj.looseAttrs)) {
         meet(lvar);
      }
   }

   return {unmet, met};
}
superIndexOfAnother ::= function (index1, index2) {
   let len = $.commonArrayPrefixLength(index1, index2);
   if (len === index2.length) {
      return index1;
   }
   else if (len === index1.length) {
      return index2;
   }
   else {
      return null;
   }
}
copyIndex ::= function (index) {
   let copy = Array.from(index);
   copy.isUnique = index.isUnique;
   return copy;
}
indexBindAttr ::= function (index, attr) {
   let i = index.indexOf(attr);
   if (i !== -1) {
      index.splice(i, 1);
   }
}
isIndexCovered ::= function (index) {
   return index.length === 0;
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
computeIncrementalUpdateScheme ::= function (relname, config0, body) {
   let scheme = new Map(
      $.map(body, dconj => [
         dconj, $.joinPathForDelta(relname, config0, body, dconj)
      ])
   );
   $.assignSlotsToJoinPathLinks(config0, scheme);
   
   return scheme;
}
joinPathForDelta ::= function (relname, config0, body, dconj) {
   let unjoined = new Set($.mapfilter(body, conj => {
      if (conj !== dconj) {
         return $.makeConjunctFulfillment(conj);
      }
   }));

   function bindLvars(lvars) {
      for (let cjff of unjoined) {
         for (let lvar of lvars) {
            $.cjffBindLvar(cjff, lvar);
         }
      }
   }

   bindLvars(Object.values(dconj.looseAttrs));

   let path = [];

   while (unjoined.size > 0) {
      let useFF = null;
      let useIndex = null;

      // Take first from 'unjoined' that we can join
      for (let cjff of unjoined) {
         let usableIndices = cjff.indices.filter($.isIndexCovered);
         
         if (usableIndices.length === 0) {
            continue;
         }

         let unique = usableIndices.find(idx => idx.original.isUnique);
         if (unique !== undefined) {
            useFF = cjff;
            useIndex = unique.original;
            break;
         }
         
         if (useFF === null) {
            useFF = cjff;
            useIndex = usableIndices[0].original;
         }
      }

      if (useFF === null) {
         // Some conjunct may be already shrunk by some index due to firmAttrs. For these
         // conjuncts, we can join them without any index.
         useFF = unjoined.find(({shrunk}) => ['index', 'scalar'].includes(shrunk)) || null;
         if (useFF === null) {
            throw new Error(
               `Relation '${relname}': cannot build join path from '${dconj.rel.name}'`
            );
         }
      }

      path.push(
         $.internJoinPathLink(useFF.conj, {
            index: useIndex,
            checkAttrs: $.cjffCheckAttrs(useFF, useIndex),
            extractAttrs: $.cjffExtractAttrs(useFF)
         })
      );

      unjoined.delete(useFF);
      bindLvars(useFF.freeLvars);
   }

   return path;
}
makeConjunctFulfillment ::= function (conj) {
   return {
      conj: conj,
      freeLvars: new Set(Object.values(conj.looseAttrs)),
      boundLvars: new Set,
      indices: Array.from(conj.indices, $.makeIndexFulfillment)
   }
}
makeIndexFulfillment ::= function (index) {
   let fulfillment = Array.from(index);
   fulfillment.original = index;
   return fulfillment;
}
cjffBindLvar ::= function (cjff, lvar) {
   if (!cjff.freeLvars.has(lvar)) {
      return;
   }

   let attr = $.conjAttrByLvar(cjff.conj, lvar);

   for (let index of cjff.indices) {
      $.indexBindAttr(index, attr);
   }

   cjff.freeLvars.delete(lvar);
   cjff.boundLvars.add(lvar);
}
conjAttrByLvar ::= function (conj, lvar) {
   for (let [attr, v] of Object.entries(conj.looseAttrs)) {
      if (v === lvar) {
         return attr;
      }
   }

   return null;
}
cjffCheckAttrs ::= function (cjff, index) {
   let checkAttrs = [];

   for (let [attr, lvar] of Object.entries(cjff.conj.looseAttrs)) {
      if (cjff.boundLvars.has(lvar) && !index.includes(attr)) {
         checkAttrs.push(attr);
      }
   }

   return checkAttrs;
}
cjffExtractAttrs ::= function (cjff) {
   let extractAttrs = [];

   for (let [attr, lvar] of Object.entries(cjff.conj.looseAttrs)) {
      if (cjff.freeLvars.has(lvar)) {
         extractAttrs.push(attr);
      }
   }
   
   return extractAttrs;   
}
internJoinPathLink ::= function (conj, linkProps) {
   let link = $.find(
      conj.joinPathLinks, link => $.areJoinPathLinksEqual(link, linkProps)
   );

   if (link !== undefined) {
      return link;
   }

   link = {
      ...linkProps,
      conj: conj,
      slot: null,  // this will be set later
   };
   conj.joinPathLinks.push(link);

   return link;
}
areJoinPathLinksEqual ::= function (link1, link2) {
   return (
      link1.index === link2.index &&
      $.areArraysEqual(link1.checkAttrs, link2.checkAttrs) &&
      $.areArraysEqual(link1.extractAttrs, link2.extractAttrs)
   );
}
assignSlotsToJoinPathLinks ::= function (config, updateScheme) {
   let conjSlots = new Map;

   for (let joinPath of updateScheme.values()) {
      for (let link of joinPath) {
         let slots = conjSlots.get(link.conj);
         if (slots === undefined) {
            slots = [];
            conjSlots.set(link.conj, slots);
         }

         let slot = $.find(slots, slot => slot.target === link.index);

         if (slot === undefined) {
            slot = {
               target: link.index,
               number: config.length
            };

            slots.push(slot);
            config.push(slot);
         }

         link.slot = slot;
      }
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