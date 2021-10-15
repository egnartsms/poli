common
   assert
   map
   trackingFinal
-----
indexOn ::= function (attrs, options={}) {
   let idx = Array.from(attrs);
   idx.isUnique = !!options.isUnique;
   return idx;
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
reduceIndex ::= function (index, attrs) {
   let reduced = $.copyIndex(index);

   for (let attr of attrs) {
      let i = reduced.indexOf(attr);
      if (i !== -1) {
         reduced.splice(i, 1);
      }
   }

   return reduced;
}
isIndexCovered ::= function (index) {
   return index.length === 0;
}
wouldIndexBeCoveredBy ::= function (index, attrs) {
   return $.isIndexCovered($.reduceIndex(index, attrs));
}
rebuildIndex ::= function (inst, recs) {
   inst.records = new Map;

   for (let rec of recs) {
      $.indexAdd(inst, rec);
   }
}
indexAdd ::= function (inst, rec) {
   let [recKey, recVal] = inst.owner.keyed !== false ? rec : [rec, rec];
   let map = inst.records;

   for (let [attr, isFinal] of $.trackingFinal(inst)) {
      let key = recVal[attr];

      if (isFinal) {
         if (map.has(key)) {
            if (inst.isUnique) {
               throw new Error(`Unique index violation`);
            }
            else {
               map.get(key).add(recKey);
            }
         }
         else {
            map.set(key, inst.isUnique ? recKey : new Set([recKey]));
         }
      }
      else {
         let next = map.get(key);

         if (next === undefined) {
            next = new Map;
            map.set(key, next);
         }

         map = next;
      }
   }
}
indexRemove ::= function (inst, rec) {
   let [recKey, recVal] = inst.owner.keyed !== false ? rec : [rec, rec];

   (function go(i, map) {
      let key = recVal[inst[i]];

      if (!map.has(key)) {
         throw new Error(`Index missing fact`);
      }

      let isFinal = i === inst.length - 1;

      if (isFinal) {
         if (inst.isUnique) {
            map.delete(key);
         }
         else {
            let bucket = map.get(key);

            bucket.delete(recKey);

            if (bucket.size === 0) {
               map.delete(key);
            }
         }
      }
      else {
         let next = map.get(key);

         go(i + 1, next);

         if (next.size === 0) {
            map.delete(key);
         }
      }
   })(0, inst.records);
}
indexAt ::= function (inst, keys) {
   let map = inst.records;

   for (let key of keys) {
      map = map.get(key);

      if (map === undefined) {
         return [];
      }
   }

   // At this point map is either a record key or a set of record key
   return inst.isUnique ? [map] : map;
}
