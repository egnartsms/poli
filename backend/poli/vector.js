common
   assert
-----
MAX_NODE_SIZE ::= 16
Vector ::= function (items=[]) {
   let vec = {
      root: null
   };

   for (let item of items) {
      $.push(vec, item);
   }

   $.freeze(vec);

   return vec;
}
isMutated ::= function (vec) {
   return vec.root !== null && vec.root.isFresh;
}
asMutable ::= function (vec) {
   if ($.isMutated(vec)) {
      throw new Error(`Attempt to make a mutable Vector from another mutable Vector`);
   }

   return {...vec};
}
freeze ::= function (vec) {
   // Mark all fresh nodes as non-fresh
   if (!$.isMutated(vec)) {
      return;
   }
   
   function freeze(node) {
      node.isFresh = false;
      if (!node.isLeaf) {
         for (let subnode of node) {
            if (subnode.isFresh) {
               freeze(subnode);
            }
         }
      }
   }

   freeze(vec.root);
}
items ::= function* (vec) {
   function* subtree(node) {
      if (node.isLeaf) {
         yield* node;
      }
      else {
         for (let subnode of node) {
            yield* subtree(subnode);
         }
      }
   }
   
   if (vec.root !== null) {
      yield* subtree(vec.root);
   }
}
at ::= function (vec, index) {
   if (vec.root === null) {
      return undefined;
   }
   
   return $.nodeAt(vec.root, index);
}
nodeAt ::= function (node, index) {
   while (!node.isLeaf) {
      $.assert(node.length > 0);

      let k = 0;

      while (k < node.length && node[k].totalSize <= index) {
         index -= node[k].totalSize;
         k += 1;
      }

      if (k === node.length) {
         return undefined;
      }

      node = node[k];
   }

   return node[index];
}
pushBack ::= function (vec, item) {
   if (vec.root === null) {
      vec.root = [item];
      $.makeNode(vec.root, true);
      return;
   }

   function pushTo(node) {
      let xnode = $.freshNode(node);

      if (xnode.isLeaf) {         
         xnode.push(item);
         xnode.totalSize = xnode.length;
      }
      else {
         let subTarget = xnode[xnode.length - 1];
         let subTargetSize = subTarget.totalSize;
         let newSubs = $.splitNode(pushTo(subTarget));
         let deltaSize = newSubs.reduce((sum, nd) => sum + nd.totalSize) - subTargetSize;

         xnode.splice(xnode.length - 1, 1, ...newSubs);
         xnode.totalSize += deltaSize;
      }

      return xnode;
   }

   let chunks = $.splitNode(pushTo(vec.root));

   while (chunks.length > 1) {
      vec.root = chunks;
      $.makeNode(vec.root, false);

      chunks = $.splitNode(vec.root);
   }

   [vec.root] = chunks;
}
splitNode ::= function (node) {
   $.assert(node.isFresh);
   
   if (node.length <= $.MAX_NODE_SIZE) {
      return [node];
   }

   let chunks = [];
   let k = node.length;

   while (k > 2 * $.MAX_NODE_SIZE) {
      let chunk = node.slice(k - $.MAX_NODE_SIZE, k);
      $.makeNode(chunk, node.isLeaf);
      chunks.push(chunk);
      k -= $.MAX_NODE_SIZE;
   }

   if (k > $.MAX_NODE_SIZE) {
      let m = k >> 1;
      
      let chunk = node.slice(m, k);
      $.makeNode(chunk, node.isLeaf);
      chunks.push(chunk);
      
      node.length = m;
      $.makeNode(node, node.isLeaf);
      chunks.push(node);
   }

   chunks.reverse();

   return chunks;
}
freshNode ::= function (node) {
   if (node.isFresh) {
      return node;
   }

   let newNode = Array.from(node);

   newNode.isFresh = true;
   newNode.isLeaf = node.isLeaf;
   newNode.totalSize = node.totalSize;

   return newNode;
}
makeNode ::= function (array, isLeaf) {
   array.isFresh = true;
   array.isLeaf = isLeaf;

   if (isLeaf) {
      array.totalSize = array.length;
   }
   else {
      array.totalSize = array.reduce((sum, nd) => sum + nd.totalSize);
   }
}
