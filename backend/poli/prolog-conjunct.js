common
   filter
   hasOwnProperty
   mapfilter
   isObjectWithOwnProperty
prolog-index
   indexBindAttr
   indexBound
   isIndexCovered
   copyIndex
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

   let indices = Array.from(rel.indices, idx => $.indexBound(idx, firmAttrs));

   return {
      rel,
      firmAttrs,
      looseAttrs,
      indices: indices.filter(idx => !$.isIndexCovered(idx)),
      shrunk: indices.reduce((M, idx) => Math.max(M, $.indexShrunk(idx)), $.Shrunk.no),
      num: -1
   }
}
indexShrunk ::= function (index) {
   return $.isIndexCovered(index) ?
      (index.isUnique ? $.Shrunk.scalar : $.Shrunk.index) :
      $.Shrunk.no;
}
Shrunk ::= ({
   no: 0,
   index: 1,
   scalar: 2,
   max: 2,
})
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
reduceIndex ::= function (index, conj, boundAttrs) {
   let reduced = $.copyIndex(index);

   for (let [attr, lvar] of Object.entries(conj.looseAttrs)) {
      if ($.hasOwnProperty(boundAttrs, lvar)) {
         $.indexBindAttr(reduced, attr);
      }
   }

   return reduced;
}
reduceConj ::= function (conj, boundAttrs) {
   let newFirms = {...conj.firmAttrs};
   let newLoose = {...conj.looseAttrs};

   for (let [attr, lvar] of Object.entries(conj.looseAttrs)) {
      if ($.hasOwnProperty(boundAttrs, lvar)) {
         newFirms[attr] = boundAttrs[lvar];
         delete newLoose[attr];
      }
   }

   let newShrunk = conj.shrunk;

   if (newShrunk < $.Shrunk.max) {
      for (let index of conj.indices) {
         let rshrunk = $.indexShrunk($.reduceIndex(index, conj, boundAttrs));

         if (rshrunk > newShrunk) {
            newShrunk = rshrunk;
            if (newShrunk === $.Shrunk.max) {
               break;
            }
         }
      }
   }
   
   return {
      rel: conj.rel,
      firmAttrs: newFirms,
      looseAttrs: newLoose,
      shrunk: newShrunk,
      num: conj.num
   }
}
