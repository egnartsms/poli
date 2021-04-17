common
   assert
-----
MAX_NODE_SIZE ::= 16
Vector ::= class Vector {
   constructor (items=[]) {
      this.root = null;

      for (let item of items) {
         $.push(this, item);
      }

      $.freeze(this);
   }
   
   get size() {
      return this.root.size;
   }

   [Symbol.iterator] () {
      return $.items(this);
   }
}
isMutated ::= function (vec) {
   return vec.root !== null && vec.root.isFresh;
}
newIdentity ::= function (vec) {
   if ($.isMutated(vec)) {
      throw new Error(`Attempt to copy the identity of a mutated Vector`);
   }

   return Object.assign(Object.create($.Vector.prototype), vec);
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
   if (vec.root !== null) {
      yield* $.genSubtree(vec.root);
   }
}
genSubtree ::= function* (node) {
   if (node.isLeaf) {
      yield* node;
   }
   else {
      for (let subnode of node) {
         yield* subtree(subnode);
      }
   }   
}
genSlice ::= function* (vec, n) {
   function* gen(node, n) {
      if (node.isLeaf) {
         yield* node.slice(n);
      }
      else {
         let i = 0;
         while (i < node.length && node[i].size <= n) {
            n -= node[i].size;
            i += 1;
         }

         if (i < node.length) {
            yield* gen(node[i], n);

            i += 1;
            while (i < node.length) {
               yield* $.genSubtree(node[i]);
               i += 1;
            }
         }
      }
   }
   
   if (vec.root !== null) {
      yield* gen(vec.root, n);
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

      while (k < node.length && node[k].size <= index) {
         index -= node[k].size;
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
         xnode.size = xnode.length;
      }
      else {
         let subTarget = xnode[xnode.length - 1];
         let subTargetSize = subTarget.size;
         let newSubs = $.splitNode(pushTo(subTarget));
         let deltaSize = newSubs.reduce((sum, nd) => sum + nd.size, 0) - subTargetSize;

         xnode.splice(xnode.length - 1, 1, ...newSubs);
         xnode.size += deltaSize;
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
   newNode.size = node.size;

   return newNode;
}
makeNode ::= function (array, isLeaf) {
   array.isFresh = true;
   array.isLeaf = isLeaf;

   if (isLeaf) {
      array.size = array.length;
   }
   else {
      array.size = array.reduce((sum, nd) => sum + nd.size, 0);
   }
}
updated ::= function (vec, fnMutator) {
   let newVec = $.newIdentity(vec);
   fnMutator(newVec);
   $.freeze(newVec);
   return newVec;
}