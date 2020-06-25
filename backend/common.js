const assert = require('assert').strict;


/**
 Return an ordered array.
 :param items: array of items
 :param propId, propPrevId: property names to access respective IDs.
*/
function orderByPrecedence(items, propId, propPrevId) {
   let id2prev = new Map;

   for (let item of items) {
      id2prev.set(item[propId], item[propPrevId]);
   }

   let ids = [];

   while (id2prev.size > 0) {
      let i = ids.length;
      let [id] = id2prev.keys();

      while (id2prev.has(id)) {
         ids.push(id);
         let prev = id2prev.get(id);
         id2prev.delete(id);
         id = prev;
      }

      // reverse part of array
      let j = ids.length - 1;
      while (i < j) {
         [ids[i], ids[j]] = [ids[j], ids[i]];
         i += 1;
         j -= 1;
      }
   }

   let id2item = new Map;
   for (let item of items) {
      id2item.set(item[propId], item);
   }

   return Array.from(ids, id => id2item.get(id));
}


function* matchAllHeaderBodyPairs(str, reHeader) {
   assert(reHeader.global);

   let prev_i = null, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (prev_mtch !== null) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }
      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}


Object.assign(exports, {
   orderByPrecedence,
   matchAllHeaderBodyPairs
});
