bootstrap
   assert
-----
MAX_NODE_SIZE ::= 16
Trie ::= function ({keyof, less}) {
   return {
      keyof,
      less,
      root: null
   };
}
isMutated ::= function (trie) {
   return trie.root !== null && trie.root.isFresh;
}
asMutable ::= function (trie) {
   if ($.isMutated(trie)) {
      throw new Error(`Attempt to make a mutable Trie from another mutable Trie`);
   }

   return {...trie};
}
freeze ::= function (trie) {
   // Mark all fresh nodes as non-fresh
   if (!$.isMutated(trie)) {
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

   freeze(trie.root);
}
items ::= function* (trie) {
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
   
   if (trie.root !== null) {
      yield* subtree(trie.root);
   }
}
search ::= function (trie, key) {
   if (trie.root === null ||
         trie.less(key, trie.root.minKey) ||
         trie.less(trie.root.maxKey, key)) {
      return null;
   }
   
   return (function searchIn(node) {
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      if (at === undefined) {
         return null;
      }
      
      if (node.isLeaf) {
         return node[at];
      }
      else {
         return searchIn(node[at]);
      }
   })(trie.root);
}
add ::= function (trie, item) {
   if (trie.root === null) {
      trie.root = [item];
      $.setNodeProps(trie.root, true);
      trie.root.minKey = trie.root.maxKey = trie.keyof(item);
      
      return true;  // was new
   }

   let wasNew;
   let itemKey = trie.keyof(item);

   function addTo(node) {
      if (node.isLeaf) {
         let newNode = $.freshNode(node);
         let {at, right} = $.nodeKeyPlace(trie, node, itemKey);
         
         if (at !== undefined) {
            wasNew = false;
            $.nodeSplice(trie, newNode, at, 1, item);
         }
         else {
            wasNew = true;
            $.nodeSplice(trie, newNode, right, 0, item);
         }
         
         return $.maybeSplit(trie, newNode);         
      }
      
      let index;
      let {at, left, right} = $.nodeKeyPlace(trie, node, itemKey);
      
      if (at !== undefined) {
         index = at;
      }
      else if (left === -1) {
         index = right;
      }
      else if (right === node.length) {
         index = left;
      }
      else if (node[left].length < node[right].length) {
         index = left;
      }
      else {
         index = right;
      }
      
      let {node: subnode, leftNode, rightNode} = addTo(node[index]);
      let newNode = $.freshNode(node);
      
      if (subnode !== undefined) {
         $.nodeSplice(trie, newNode, index, 1, subnode);
      }
      else {
         $.nodeSplice(trie, newNode, index, 1, leftNode, rightNode);
      }
      
      return $.maybeSplit(trie, newNode);
   }

   let {node: root, leftNode, rightNode} = addTo(trie.root);

   if (root !== undefined) {
      trie.root = root;
   }
   else {
      trie.root = [leftNode, rightNode];
      $.setNodeProps(trie.root, false);
      trie.root.minKey = leftNode.minKey;
      trie.root.maxKey = rightNode.maxKey;
   }

   return wasNew;
}
deleteByKey ::= function (trie, key) {
   if (trie.root === null) {
      return false;
   }

   let didDelete = false;

   function deleteFrom(node) {
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      if (at === undefined) {
         return node;
      }
      
      if (node.isLeaf) {
         didDelete = true;

         if (node.length === 1) {
            return null;  // it was the only item in the whole trie
         }

         let newNode = $.freshNode(node);
         $.nodeSplice(trie, newNode, at, 1);
         
         return newNode;
      }

      let oldSub = node[at];
      let oldSubLength = oldSub.length;
      let newSub = removeFrom(oldSub);
      
      $.assert(newSub.isFresh);

      // In this implementation, we don't bother to move subnodes between neighboring
      // nodes to satisfy the minimum node size constraint.  Instead, we check for
      // whether it's possible to merge neighboring subnodes.

      if (newSub.length < oldSubLength) {
         let neighbor = $.smallerNeighborIndex(node, at);
         if (newSub.length + node[neighbor].length <= $.MAX_NODE_SIZE) {
            // Merge them, reuse 'newSub' as it is fresh
            $.splice(trie, newSub, neighbor < at ? 0 : newSub.length, 0, ...node[neighbor]);
            
            // If 'node' is the root, it's possible that 'node.length == 2'. This is how
            // the tree may shorten at all.
            if (node.length === 2) {
               return newSub;
            }
            
            let newNode = $.freshNode(node);
            $.splice(trie, newNode, Math.min(at, neighbor), 2, newSub);
            return newNode;
         }
      }

      if (newSub === oldSub) {
         return node;
      }
      
      let newNode = $.freshNode(node);
      $.splice(trie, newNode, at, 1, newSub);
      
      return newNode;
   }
   
   trie.root = deleteFrom(trie.root);

   return didDelete;
}
isNodeFull ::= function (node) {
   return node.length === $.MAX_NODE_SIZE;
}
nodeKeyPlace ::= function (trie, node, key) {
   let i = 0;
   let j = node.length - 1;
   
   while (i <= j) {
      let k = (i + j) >> 1;
      let loKey, hiKey;
      
      // actually, the subnodes will either be all items or all nodes
      if (node.isLeaf) {
         loKey = hiKey = trie.keyof(node[k]);
      }
      else {
         loKey = node[k].minKey;
         hiKey = node[k].maxKey;
      }
      
      if (trie.less(key, loKey)) {
         j = k - 1;
      }
      else if (trie.less(hiKey, key)) {
         i = k + 1;
      }
      else {
         return {
            at: k
         };
      }
   }
   
   return {
      left: j,
      right: i
   }
}
smallerNeighborIndex ::= function (parent, i) {
   let neighborLength = $.MAX_NODE_SIZE + 1;
   let neighbor;
   
   if (i > 0 && parent[i - 1].length < neighborLength) {
      neighbor = i - 1;
      neighborLength = parent[neighbor].length;
   }
   if (i + 1 < parent.length && parent[i + 1].length < neighborLength) {
      neighbor = i + 1;
      neighborLength = parent[neighbor].length;
   }
   
   return neighbor;
}
setNodeProps ::= function (array, isLeaf) {
   array.isLeaf = isLeaf;
   array.isFresh = true;
}
minKeyOf ::= function (trie, node) {
   return node.isLeaf ? trie.keyof(node[0]) : node[0].minKey;
}
maxKeyOf ::= function (trie, node) {
   return node.isLeaf ? trie.keyof(node[node.length - 1]) : node[node.length - 1].maxKey;
}
nodeSplice ::= function (trie, node, index, deleteCount, ...insert) {
   let lastAffected = (node.length - index <= deleteCount);

   let result = node.splice(index, deleteCount, ...insert);
   
   $.assert(node.length > 0);

   if (index === 0) {
      node.minKey = $.minKeyOf(trie, node);
   }
   
   if (lastAffected) {
      node.maxKey = $.maxKeyOf(trie, node);
   }

   return result;
}
maybeSplit ::= function (trie, node) {
   $.assert(node.isFresh);

   if (node.length > $.MAX_NODE_SIZE) {
      let Rnode = $.splice(trie, node, node.length >> 1, node.length);
      
      $.setNodeProps(Rnode, node.isLeaf);
      Rnode.minKey = $.minKeyOf(trie, Rnode);
      Rnode.maxKey = $.maxKeyOf(trie, Rnode);    
      
      return {
         leftNode: node,
         rightNode: Rnode
      }
   }
   else {
      return {
         node: node
      }
   }
}
freshNode ::= function (node) {
   if (node.isFresh) {
      return node;
   }

   let newNode = Array.from(node);

   $.setNodeProps(newNode, node.isLeaf);
   newNode.minKey = node.minKey;
   newNode.maxKey = node.maxKey;

   return newNode;
}
