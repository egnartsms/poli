common
   commonArrayPrefixLength
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

   let rel = {
      isFactual: false,
      name: name,
      attrs: attrs,
      attr2lvar: attr2lvar,
      lvars: lvars,
      body: body,
      indices: null,
      query2proj: new Map,
      projs: new Set,
      validProjs: new Set,
   };

   for (let lvar of lvars) {
      lvar.rel = rel;
   }
   
   $.checkConjunctsSanity(rel);
   $.checkVarUsage(rel);

   rel.indices = $.inferIndices(rel);
   
   return rel;
}
checkConjunctsSanity ::= function (Rel) {
   let lvars = new Set;

   for (let {rel, attrs} of Rel.body) {
      let missingAttrs = Object.keys(attrs).filter(a => !rel.attrs.includes(a));
      if (missingAttrs.length > 0) {
         let names = missingAttrs.map(a => `'${a}'`).join(', ');
         throw new Error(
            `Relation '${Rel.name}': missing attrs ${names} in relation '${rel.name}'`
         );
      }

      lvars.clear();

      for (let val of Object.values(attrs)) {
         if ($.islvar(val)) {
            if (lvars.has(val)) {
               throw new Error(
                  `Relation '${Rel.name}': duplicate var '${val[$.lvname]}' in the body`
               );
            }
            lvars.add(val);
         }
      }
   }
}
checkVarUsage ::= function (Rel) {
   let unmet = new Set(Rel.lvars);
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
      else if (used.has(lvar))
         ;
      else {
         throw new Error(`Encountered an lvar from extraneous vpool: '${lvar}'`);
      }
   }

   for (let lvar of Rel.lvars) {
      if (lvar.tiedToAttr) {
         meet(lvar);
      }
   }

   for (let {attrs} of Rel.body) {
      for (let val of Object.values(attrs)) {
         if ($.islvar(val)) {
            meet(val);
         }
      }
   }

   if (unmet.size > 0) {
      let names = Array.from(unmet, v => `'${v[$.lvname]}'`).join(', ');
      throw new Error(`Lvars not used anywhere: ${names}`);
   }

   if (met.size > 0) {
      let names = Array.from(met, v => `'${v[$.lvname]}'`).join(', ');
      throw new Error(`Lvars mentioned once but otherwise not used: ${names}`);
   }
}
inferIndices ::= function (Rel) {
   let indices = [];

   function add(newIndex) {
      let insteadOf;  // null - don't add; undefined - push

      for (let index of indices) {
         let cl = $.commonArrayPrefixLength(index, newIndex);

         if (cl === index.length) {
            // 'newIndex' is a superindex => consider adding in instead of 'index'
            if (index.unique) {
               if (newIndex.length > index.length) {
                  throw new Error(`Logic error: unique index has a super index`);
               }
               // otherwise, it's an attempt to add the same unique index or otherwise
               // equal non-unique index. In both cases, preserve the old unique index.
               insteadOf = null;
            }
            else {
               insteadOf = index;
            }

            break;
         }
         else if (cl === newIndex.length) {
            // 'newIndex' is a subindex => we don't need it
            insteadOf = null;
            break;
         }
      }

      if (insteadOf !== null) {
         if (insteadOf === undefined) {
            indices.push(newIndex);
         }
         else {
            indices.splice(indices.indexOf(insteadOf), 1, newIndex);
         }
      }
   }

   for (let {rel, attrs} of Rel.body) {
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
