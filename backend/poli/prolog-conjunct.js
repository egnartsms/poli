common
   filter
   mapfilter
   isObjectWithOwnProperty
prolog-index
   indexBindAttr
   isIndexCovered
-----
specInvalidAttrs ::= function ({attrs, rel}) {
   return Object.keys(attrs).filter(a => !rel.attrs.includes(a));
}
fromSpec ::= function ({attrs, rel}, lvname) {
   function isLvar(obj) {
      return $.isObjectWithOwnProperty(obj, lvname);
   }

   let firmAttrs = Object.fromEntries(
      $.filter(Object.entries(attrs), ([attr, val]) => !isLvar(val))
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
      num: -1
   }
}
lvarsIn ::= function (conj) {
   return Object.values(conj.looseAttrs);
}
duplicateVarIn ::= function (conj) {
   let lvars = new Set;

   for (let lvar of $.lvarsIn(conj)) {
      if (lvars.has(lvar)) {
         return lvar;
      }
      
      lvars.add(lvar);
   }

   return null;
}
varUsageSanity ::= function (lvars, attrs, conjs) {
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

   for (let conj of conjs) {
      for (let lvar of $.lvarsIn(conj)) {
         meet(lvar);
      }
   }

   return {unmet, met};
}
