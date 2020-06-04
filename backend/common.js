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


exports.orderByPrecedence = orderByPrecedence;
