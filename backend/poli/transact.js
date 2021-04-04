bootstrap
   hasOwnProperty
-----
nihil ::= Object.create(null)
objFwdDeltas ::= new Map
objFwdDeltaFor ::= function (obj) {
   let delta = $.objFwdDeltas.get(obj);
   if (delta === undefined) {
      delta = {};
      $.objFwdDeltas.set(obj, delta);
   }
   return delta;
}
DpropSet ::= function (obj, key, val) {
   // We currently only use $.DpropSet, $.DpropGet, $.DpropDel and $.objFwdDeltas for
   // module.rtobj modifications. Everything else is managed through backward deltas.
   $.objFwdDeltaFor(obj)[key] = val;
}
DpropGet ::= function (obj, key) {
   let delta = $.objFwdDeltas.get(obj);

   if (delta !== undefined && $.hasOwnProperty(delta, obj)) {
      let val = delta[obj];
      return val === $.nihil ? undefined : val;
   }
   else {
      return obj[key];
   }
}
DpropDel ::= function (obj, key) {
   $.DpropSet(obj, key, $.nihil);
}
objBwdDeltas ::= new Map
objBwdDeltaFor ::= function (obj) {
   let delta = $.objBwdDeltas.get(obj);
   if (delta === undefined) {
      delta = {};
      $.objBwdDeltas.set(obj, delta);
   }
   return delta;
}
propSet ::= function (obj, key, val) {
   let delta = $.objBwdDeltaFor(obj);
   if (!$.hasOwnProperty(delta, key)) {
      // Save original value
      delta[key] = $.hasOwnProperty(obj, key) ? obj[key] : $.nihil;
   }
   obj[key] = val;
}
propAssign ::= function (obj, from) {
   for (let [key, val] of Object.entries(from)) {
      $.propSet(obj, key, val);
   }
}
propDel ::= function (obj, key) {
   if (!$.hasOwnProperty(obj, key))
      return;

   let delta = $.objBwdDeltaFor(obj);
   if (!$.hasOwnProperty(delta, key)) {
      // Save original value
      delta[key] = obj[key];
   }
   delete obj[key];
}
setBwdDeltas ::= new Map
setBwdDeltaFor ::= function (set) {
   let delta = $.setBwdDeltas.get(set);
   if (delta === undefined) {
      delta = new Map;  // {elt: true (add it back) / false (delete it)}
      $.setBwdDeltas.set(set, delta);
   }

   return delta;
}
setAdd ::= function (set, elt) {
   if (set.has(elt)) {
      return set;
   }

   let delta = $.setBwdDeltaFor(set);
   delta.set(elt, false);
   set.add(elt);

   return set;
}
setDelete ::= function (set, elt) {
   let deleted = set.delete(elt);

   if (deleted) {
      let delta = $.setBwdDeltaFor(set);
      delta.set(elt, true);
   }

   return deleted;
}
setRemove ::= function (set, elt) {
   let deleted = $.setDelete(set, elt);
   if (!deleted) {
      throw new Error(`setRemove() did not remove the element`);
   }
}
mapBwdDeltas ::= new Map
mapBwdDeltaFor ::= function (map) {
   let delta = $.mapBwdDeltas.get(map);
   if (delta === undefined) {
      delta = new Map;  // {elt: old_value or nihil}
      $.mapBwdDeltas.set(map, delta);
   }

   return delta;
}
mapSet ::= function (map, key, val) {
   let delta = $.mapBwdDeltaFor(map);
   if (!delta.has(key)) {
      delta.set(key, map.has(key) ? map.get(key) : $.nihil);
   }
   return map.set(key, val);
}
mapDelete ::= function (map, key) {
   if (!map.has(key)) {
      return false;
   }

   let delta = $.mapBwdDeltaFor(map);
   delta.set(key, map.get(key));
   map.delete(key);
   return true;
}
mapRemove ::= function (map, key) {
   let deleted = $.mapDelete(map, key);
   if (!deleted) {
      throw new Error(`mapRemove() did not remove the key`);
   }
}
arrayCopies ::= new Map
ensureArraySaved ::= function (arr) {
   if (!$.arrayCopies.has(arr)) {
      $.arrayCopies.set(arr, [...arr]);
   }
}
splice ::= function (arr, ...args) {
   $.ensureArraySaved(arr);
   return Array.prototype.splice.apply(arr, args);
}
arraySet ::= function (arr, idx, val) {
   $.ensureArraySaved(arr);
   arr[idx] = val;
}
commit ::= function () {
   $.arrayCopies.clear();
   $.mapBwdDeltas.clear();
   $.setBwdDeltas.clear();
   $.objBwdDeltas.clear();

   for (let [obj, delta] of $.objFwdDeltas) {
      $.applyObjDelta(obj, delta);
   }

   $.objFwdDeltas.clear();
}
rollback ::= function () {
   for (let [arr, copy] of $.arrayCopies) {
      arr.length = copy.length;
      for (let i = 0; i < copy.length; i += 1) {
         arr[i] = copy[i];
      }
   }
   $.arrayCopies.clear();
   
   for (let [map, delta] of $.mapBwdDeltas) {
      for (let [key, oldval] of delta) {
         oldval === $.nihil ? map.delete(key) : map.set(key, oldval);
      }
   }
   $.mapBwdDeltas.clear();

   for (let [set, delta] of $.setBwdDeltas) {
      for (let [elt, addBack] of delta) {
         addBack ? set.add(elt) : set.delete(elt);
      }
   }
   $.setBwdDeltas.clear();

   for (let [obj, delta] of $.objBwdDeltas) {
      $.applyObjDelta(obj, delta);
   }
   $.objBwdDeltas.clear();

   $.objFwdDeltas.clear();
}
applyObjDelta ::= function (obj, delta) {
   for (let [key, val] of Object.entries(delta)) {
      if (val === $.nihil) {
         delete obj[key];
      }
      else {
         obj[key] = val;
      }
   }
}
