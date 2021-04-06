bootstrap
   assert
-----
obj2id ::= new WeakMap
nextOid ::= 1
objectId ::= function (obj) {
   let oid = $.obj2id.get(obj);
   if (oid === undefined) {
      oid = $.nextOid;
      $.obj2id.set(obj, oid);
      $.nextOid += 1;
   }
   return oid;
}
MIN_NODE_SIZE ::= 8
MAX_NODE_SIZE ::= 16
Trie ::= function (item2key) {
   return {
      item2key,
      root: null
   };
}
trieItems ::= function* (trie) {
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
trieSearch ::= function (trie, key) {
   if (trie.root === null || key < trie.root.minKey || key > trie.root.maxKey) {
      return null;
   }
   
   return $.nodeSearch(trie.root, key, trie.item2key);
}
trieAdd ::= function (trie, item) {
   if (trie.root === null) {
      root = [item];
      $.makeLeaf(root, trie.item2key);
      
      return {
         item2key: trie.item2key,
         root: root
      }
   }
   else {
      let {node: root, leftNode, rightNode} = $.nodeAdd(trie.root, item, trie.item2key);
      if (root === undefined) {
         root = [leftNode, rightNode];
         $.makeInterior(root);
      }
      
      return {
         item2key: trie.item2key,
         root: root
      }
   }
}
trieRemove ::= function (trie, key) {
   if (trie.root === null) {
      return trie;
   }
   
   let newRoot = $.nodeRemove(trie.root, key, trie.item2key);
   if (newRoot === trie.root) {
      return trie;
   }
   else {
      return {
         item2key: trie.item2key,
         root: newRoot
      }
   }
}
isNodeFull ::= function (node) {
   return node.length === $.MAX_NODE_SIZE;
}
nodeKeyPlace ::= function (node, key, item2key) {
   let i = 0;
   let j = node.length - 1;
   
   while (i <= j) {
      let k = (i + j) >> 1;
      let subnode = node[k];
      let subMin, subMax;
      
      // actually, the subnodes will either be all items or all nodes
      if (node.isLeaf) {
         subMin = subMax = item2key(subnode);
      }
      else {
         subMin = subnode.minKey;
         subMax = subnode.maxKey;
      }
      
      if (key > subMax) {
         i = k + 1;
      }
      else if (key < subMin) {
         j = k - 1;
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
nodeSearch ::= function (node, key, item2key) {
   let {at} = $.nodeKeyPlace(node, key, item2key);
   
   if (at === undefined) {
      return null;
   }
   
   if (node.isLeaf) {
      return node[at];
   }
   else {
      return $.nodeSearch(node[at], key, item2key);
   }
}
nodeAdd ::= function (node, item, item2key) {
   return (node.isLeaf ? $.leafAdd : $.interiorAdd)(node, item, item2key);
}
leafAdd ::= function (node, item, item2key) {
   let array = node.slice();
   let {at, right} = $.nodeKeyPlace(node, item2key(item), item2key);
   
   if (at !== undefined) {
      array.splice(at, 1, item);
   }
   else {
      array.splice(right, 0, item);
   }
   
   return $.arrayToNodes(array, true, item2key);
}
interiorAdd ::= function (node, item, item2key) {
   let index;
   let {at, left, right} = $.nodeKeyPlace(node, item2key(item), item2key);
   
   if (at !== undefined) {
      index = at;
   }
   else if (left === -1) {
      index = 0;
   }
   else if (right === node.length) {
      index = node.length - 1;
   }
   else if (node[left].length < node[right].length) {
      index = left;
   }
   else {
      index = right;
   }
   
   let {
      node: subnode,
      leftNode,
      rightNode
   } = $.nodeAdd(node[index], item, item2key);
   let array = node.slice();
   
   if (subnode !== undefined) {
      array[index] = subnode;
   }
   else {
      // insert 2 subnodes instead of the one at 'index'
      array.splice(index, 1, leftNode, rightNode);
   }
   
   return $.arrayToNodes(array, false, item2key);
}
nodeRemove ::= function (node, key, item2key) {
   let {at} = $.nodeKeyPlace(node, key, item2key);
   
   if (at === undefined) {
      return node;
   }
   
   if (node.isLeaf) {
      node = Array.from(node);
      node.splice(at, 1);
      $.makeLeaf(node, item2key);
      return node;
   }
   else {
      let subnode = $.nodeRemove(node[at], key, item2key);
      
      if (subnode === node[at]) {
         return node;
      }
      
      // In this implementation, we don't bother to move subnodes between neighboring
      // nodes to satisfy the $.MIN_NODE_SIZE constraint.  Instead, we check for
      // whether it's possible to merge neighboring nodes.
      
      if (subnode.length < node[at].length) {
         // Find the smaller neighbor
         let neighbor = $.smallerNeighborIndex(node, at);
               
         if (subnode.length + node[neighbor].length <= $.MAX_NODE_SIZE) {
            // Merge them, reuse 'subnode' as it is a fresh array
            subnode.splice(neighbor < at ? 0 : subnode.length, 0, ...node[neighbor]);
            $.makeNode(subnode, subnode.isLeaf, item2key);
            
            node = Array.from(node);
            node.splice(at, 1, subnode);
            node.splice(neighbor, 1);
            $.makeInterior(node);
            
            return node;
         }
      }
      
      node = Array.from(node);
      node.splice(at, 1, subnode);
      $.makeInterior(node);
      
      return node;
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
makeLeaf ::= function (array, item2key) {
   array.isLeaf = true;
   array.minKey = item2key(array[0]);
   array.maxKey = item2key(array[array.length - 1]);
}
makeInterior ::= function (array) {
   array.isLeaf = false;
   array.minKey = array[0].minKey;
   array.maxKey = array[array.length - 1].maxKey;
}
makeNode ::= function (array, isLeaf, item2key) {
   if (isLeaf) {
      $.makeLeaf(array, item2key);
   }
   else {
      $.makeInterior(array);
   }
}
splitNode ::= function (array, isLeaf, item2key) {
   let Rarray = array.splice(array.length >> 1, array.length);
   
   $.makeNode(array, isLeaf, item2key);
   $.makeNode(Rarray, isLeaf, item2key);
   
   return {
      leftNode: array,
      rightNode: Rarray
   }
}
arrayToNodes ::= function (array, isLeaf, item2key) {
   if (array.length > $.MAX_NODE_SIZE) {
      return $.splitNode(array, isLeaf, item2key);
   }
   else {
      $.makeNode(array, isLeaf, item2key)
      return {
         node: array
      }
   }
}
