common
   assert
   hasOwnProperty
   commonArrayPrefixLength
   singleQuoteJoinComma
   map
   mapfilter
-----
lvname ::= Symbol('lvar')
islvar ::= function (obj) {
   return obj != null && obj[$.lvname] !== undefined;
}
inferredRelation ::= function (callback) {
   let vpool = new Map;

   function getvar(name) {
      if (!vpool.has(name)) {
         vpool.set(name, {
            [$.lvname]: name,
            tiedToAttr: false,
            rel: null
         });
      }

      return vpool.get(name);    
   }

   let {name, attrs, body} = callback(function (strings) {
      if (strings.length !== 1) {
         throw new Error(`Logical variable names don't support inline expressions`);
      }

      let [name] = strings;

      return getvar(name);
   });

   let attr2lvar = new Map;

   for (let attr of attrs) {
      let lvar = getvar(attr);
      lvar.tiedToAttr = true;
      attr2lvar.set(attr, lvar);
   }

   let lvars = Array.from(vpool.values());

   for (let conjunct of body) {
      let invalidAttrs = $.conjunctInvalidAttrs(conjunct);

      if (invalidAttrs.length > 0) {
         throw new Error(
            `Relation '${name}': missing attr(s) ` +
            `${$.singleQuoteJoinComma(invalidAttrs)} in conjunct '${conjunct.rel.name}'`
         );
      }
   }

   for (let conjunct of body) {
      let dupVar = $.conjunctDuplicateVar(conjunct);

      if (dupVar !== null) {
         throw new Error(
            `Relation '${name}': duplicate var '${dupVar[$.lvname]}' in conjunct ` +
            `'${conjunct.rel.name}'`
         );
      }
   }

   {
      let {met, unmet, extraneous} = $.varUsageSanity(
         lvars, Array.from(attr2lvar.values()), body
      );

      if (extraneous.size > 0) {
         let names = $.singleQuoteJoinComma($.map(extraneous, v => v[$.lvname]));
         throw new Error(
            `Relation '${name}': encountered lvar(s) from extraneous pool: ${names}`
         );
      }

      if (unmet.size > 0) {
         let names = $.singleQuoteJoinComma($.map(unmet, v => v[$.lvname]));
         throw new Error(`Relation '${name}': lvars not used anywhere: ${names}`);
      }

      if (met.size > 0) {
         let names = $.singleQuoteJoinComma($.map(met, v => v[$.lvname]));
         throw new Error(
            `Relation '${name}': lvars mentioned once but otherwise not used: ${names}`
         );
      }
   }
   
   let rel = {
      isFactual: false,
      name: name,
      attrs: attrs,
      attr2lvar: attr2lvar,
      lvars: lvars,
      body: body,
      indices: $.inferIndices(body),
      query2proj: new Map,
      projs: new Set,
      validProjs: new Set,
   };

   for (let lvar of lvars) {
      lvar.rel = rel;
   }
   
   return rel;
}
conjunctInvalidAttrs ::= function (conj) {
   let {attrs, rel} = conj;
   return Object.keys(attrs).filter(a => !rel.attrs.includes(a));
}
conjunctDuplicateVar ::= function (conj) {
   let lvars = new Set;

   for (let lvar of $.conjunctLvars(conj)) {
      if (lvars.has(lvar)) {
         return lvar;
      }
      
      lvars.add(lvar);
   }

   return null;
}
conjunctLvars ::= function (conj) {
   return Object.values(conj.attrs).filter($.islvar);
}
conjunctDynEntries ::= function (conj) {
   return Object.entries(conj.attrs).filter(([attr, lvar]) => $.islvar(lvar));
}
conjunctStatEntries ::= function (conj) {
   return Object.entries(conj.attrs).filter(([attr, val]) => !$.islvar(val));
}
varUsageSanity ::= function (lvars, lvarsTiedToAttrs, body) {
   let unmet = new Set(lvars);
   let met = new Set;
   let used = new Set;
   let extraneous = new Set;

   function meet(lvar) {
      if (unmet.has(lvar)) {
         unmet.delete(lvar);
         met.add(lvar);
      }
      else if (met.has(lvar)) {
         met.delete(lvar);
         used.add(lvar);
      }
      else if (used.has(lvar))
         ;
      else {
         extraneous.add(lvar);
         // throw new Error(
         //    `Relation '${Rel.name}': Encountered an lvar from extraneous vpool: '${lvar}'`
         // );
      }
   }

   for (let lvar of lvarsTiedToAttrs) {
      meet(lvar);
   }

   for (let conjunct of body) {
      for (let lvar of $.conjunctLvars(conjunct)) {
         meet(lvar);
      }
   }

   return {unmet, met, extraneous};
}
inferIndices ::= function (body) {
   let indices = [];

   function add(newIndex) {
      for (let index of indices) {
         let sup = $.superIndexOfAnother(newIndex, index);

         if (sup === newIndex) {
            // consider adding 'newIndex' instead of 'index'
            if (index.unique) {
               if (newIndex.length > index.length) {
                  throw new Error(`Logic error: unique index has a super index`);
               }
               // otherwise, it's an attempt to add the same unique index or otherwise
               // equal non-unique index. In both cases, preserve the old unique index.
            }
            else {
               indices.splice(indices.indexOf(index), 1, newIndex);
            }

            return;
         }
         else if (sup === index) {
            // 'newIndex' is a subindex => we don't need it
            return;
         }
      }

      indices.push(newIndex);
   }

   for (let {rel, attrs} of body) {
      for (let index of rel.indices) {
         let newIndex = [];

         for (let idxAttr of index) {
            if ($.islvar(attrs[idxAttr]) && attrs[idxAttr].tiedToAttr) {
               newIndex.push(attrs[idxAttr][$.lvname]);
            }
            else {
               break;
            }
         }

         if (newIndex.length > 0) {
            newIndex.unique = index.unique && (index.length === newIndex.length);
            add(newIndex);
         }
      }
   }

   return indices;
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
visualizeIncrementalUpdatePlan ::= function (rel) {
   let plan = $.computeIncrementalUpdatePlan(rel);

   function* gen() {
      yield '\n';
      for (let [dconj, path] of plan) {
         yield `D(${dconj.rel.name})`;
         for (let item of path) {
            yield ` -> ${item.rel.name}(${item.index.join(', ')})`;
            if (item.checkAttrs.size > 0) {
               yield ` checking (${[...item.checkAttrs.keys()].join(', ')})`;
            }
            if (item.bindAttrs.size > 0) {
               yield ` getting (${Array.from(item.bindAttrs.values(), lv => lv[$.lvname]).join(', ')})`;
            }
         }
         yield '\n';
      }
   }

   return Array.from(gen()).join('');
}
computeIncrementalUpdatePlan ::= function (rel) {
   return new Map($.map(rel.body, dconj => [dconj, $.joinPathForDelta(rel, dconj)]));
}
joinPathForDelta ::= function (rel, dconj) {
   let unjoined = new Set($.mapfilter(rel.body, conj => {
      if (conj !== dconj) {
         return $.makeConjunctFulfillment(conj);
      }
   }));
   let freeLvars = new Set(rel.lvars);

   function bindLvars(lvars) {
      for (let conjff of unjoined) {
         for (let lvar of lvars) {
            $.conjffBindLvar(conjff, lvar);
         }
      }

      for (let lvar of lvars) {
         freeLvars.delete(lvar);
      }
   }

   bindLvars($.conjunctLvars(dconj));

   let path = [];

   while (unjoined.size > 0) {
      // Take first from 'unjoined' that we can join
      let xconjff = null;
      let xidxff = null;

      for (let conjff of unjoined) {
         let idxffsReady = $.conjffReadyIndices(conjff);
         
         if (idxffsReady.length === 0) {
            continue;
         }

         let idxff = idxffsReady.find(ff => ff.index.unique);
         if (idxff !== undefined) {
            xconjff = conjff;
            xidxff = idxff;
            break;
         }
         
         if (xconjff === null) {
            xconjff = conjff;
            xidxff = idxffsReady[0];
         }
      }

      if (xconjff === null) {
         throw new Error(
            `Relation '${rel.name}': cannot build join path from '${dconj.rel.name}'`
         );
      }

      // All the bound attributes of the conjunct fulfillment that are not part
      // of the selected index must be checked separately
      let checkAttrs = $.conjffBoundAttrsMap(xconjff);
      for (let attr of xidxff.dynBound.keys()) {
         checkAttrs.delete(attr);
      }

      path.push({
         rel: xconjff.conj.rel,
         index: xidxff.index,
         indexAttrs: xidxff.dynBound,
         checkAttrs: checkAttrs,
         bindAttrs: new Map($.map(xconjff.freeLvars, lvar => [
            xconjff.lvar2attr.get(lvar), lvar
         ]))
      });

      bindLvars([...xconjff.freeLvars]);
      unjoined.delete(xconjff);
   }

   return path;
}
makeConjunctFulfillment ::= function (conj) {
   return {
      conj: conj,
      freeLvars: new Set($.conjunctLvars(conj)),
      boundLvars: new Set,
      lvar2attr: new Map(
         $.map($.conjunctDynEntries(conj), ([attr, lvar]) => [lvar, attr])
      ),
      idxffs: Array.from(conj.rel.indices, index => $.makeIndexFulfillment(index, conj))
   }
}
makeIndexFulfillment ::= function (index, conj) {
   let freeAttrs = new Set(index);

   for (let [attr] of $.conjunctStatEntries(conj)) {
      freeAttrs.delete(attr);
   }

   return {
      index: index,
      // Dynamically bound attributes are those that are tied to lvars and become bound
      // when their corresponding lvars become bound
      dynBound: new Map,  // attr -> lvar
      freeAttrs: freeAttrs
   };
}
conjffBindLvar ::= function ({freeLvars, boundLvars, lvar2attr, idxffs}, lvar) {
   if (!freeLvars.has(lvar)) {
      return;
   }

   let attr = lvar2attr.get(lvar);

   for (let idxff of idxffs) {
      $.idxffBindAttr(idxff, attr, lvar);
   }

   freeLvars.delete(lvar);
   boundLvars.add(lvar);
}
idxffBindAttr ::= function ({freeAttrs, dynBound}, attr, lvar) {
   if (freeAttrs.has(attr)) {
      dynBound.set(attr, lvar);
      freeAttrs.delete(attr);
   }
}
conjffReadyIndices ::= function ({idxffs}) {
   return idxffs.filter($.isIdxFfReady);
}
isIdxFfReady ::= function ({freeAttrs}) {
   return freeAttrs.size === 0;
}
conjffBoundAttrsMap ::= function ({boundLvars, lvar2attr}) {
   return new Map($.map(boundLvars, lvar => [lvar2attr.get(lvar), lvar]));
}
