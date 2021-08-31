common
   filter
   hasOwnProperty
   mapfilter
   isObjectWithOwnProperty
data-structures
   BidiMap
prolog-index
   indexBindAttr
   reduceIndex
   isIndexCovered
   copyIndex
prolog-shared
   recKey
   recVal
-----
fromSpec ::= function ({attrs, rel}, lvname) {
   function isLvar(obj) {
      return $.isObjectWithOwnProperty(obj, lvname);
   }

   let firmAttrs = Object.fromEntries(
      $.mapfilter(Reflect.ownKeys(attrs), a => {
         let val = attrs[a];
         if (!isLvar(val)) {
            return [a, val];
         }
      })
   );
   let looseAttrs = new $.BidiMap(
      $.mapfilter(Reflect.ownKeys(attrs), a => {
         let lvar = attrs[a];
         if (isLvar(lvar)) {
            return [a, lvar[lvname]];
         }
      })
   );

   let indices = Array.from(
      rel.indices, idx => $.reduceIndex(idx, Object.keys(firmAttrs))
   );

   return {
      rel,
      firmAttrs,
      looseAttrs,
      indices: indices.filter(idx => !$.isIndexCovered(idx)),
      shrunk: indices.reduce((M, idx) => Math.max(M, $.indexShrunk(idx)), $.Shrunk.min),
      num: -1
   }
}
indexShrunk ::= function (index) {
   return $.isIndexCovered(index) ?
      (index.isUnique ? $.Shrunk.scalar : $.Shrunk.index) :
      $.Shrunk.no;
}
Shrunk ::= ({
   min: 0,
   no: 0,
   index: 1,
   scalar: 2,
   max: 2,
})
lvarsIn ::= function (conj) {
   return Array.from(conj.looseAttrs.values());
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
reduceConjIndex ::= function (index, conj, boundAttrs) {
   return $.reduceIndex(
      index,
      $.mapfilter(conj.looseAttrs, ([attr, lvar]) => {
         if ($.hasOwnProperty(boundAttrs, lvar)) {
            return attr;
         }
      })
   );
}
reduceConj ::= function (conj, boundAttrs) {
   let newFirms = {...conj.firmAttrs};
   let newLoose = new $.BidiMap(conj.looseAttrs);

   for (let [attr, lvar] of conj.looseAttrs) {
      if ($.hasOwnProperty(boundAttrs, lvar)) {
         newFirms[attr] = boundAttrs[lvar];
         newLoose.delete(attr);
      }
   }

   let newShrunk = conj.shrunk;

   if (newShrunk < $.Shrunk.max) {
      for (let index of conj.indices) {
         let rshrunk = $.indexShrunk($.reduceConjIndex(index, conj, boundAttrs));

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
