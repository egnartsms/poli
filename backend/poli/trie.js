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
MAX_NODE_SIZE ::= 16
Trie ::= function (cmp) {
   return {
      cmp,
      root: null
   };
}
isMutable ::= function (trie) {
   return trie.root !== null && trie.root.isFresh;
}
asMutable ::= function (trie) {
   if ($.isMutable(trie)) {
      throw new Error(`Attempt to make a mutable Trie from another mutable Trie`);
   }

   return {...trie};
}
freeze ::= function (trie) {
   // Mark all fresh nodes as non-fresh
   if (!$.isMutable(trie)) {
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
   }(trie.root)
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
searchItem ::= function (trie, key) {
   if (trie.root === null ||
         trie.cmp(key, trie.root.least) < 0 ||
         trie.cmp(key, trie.root.greatest) > 0) {
      return null;
   }
   
   return (function searchIn(node) {
      let {at} = $.nodeKeyPlace(node, key, trie.cmp);
      
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
addItem ::= function (trie, item, key) {
   if (trie.root === null) {
      trie.root = [item];
      $.makeNode(trie.root, true);

      return true;  // was new
   }

   let wasNew;

   function addTo(node) {
      if (node.isLeaf) {
         let newNode = $.freshNode(node);
         let {at, right} = $.nodeKeyPlace(node, key, trie.cmp);
         
         if (at !== undefined) {
            wasNew = false;
            newNode.splice(at, 1, item);
         }
         else {
            wasNew = true;
            newNode.splice(right, 0, item);
         }
         
         return $.maybeSplit(newNode);         
      }
      
      let index;
      let {at, left, right} = $.nodeKeyPlace(node, key, trie.cmp);
      
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
         newNode[index] = subnode;
      }
      else {
         newNode.splice(index, 1, leftNode, rightNode);
      }
      
      return $.maybeSplit(newNode);
   }

   let {node: root, leftNode, rightNode} = addTo(trie.root);

   if (root !== undefined) {
      trie.root = root;
   }
   else {
      trie.root = [leftNode, rightNode];
      $.makeNode(trie.root, false);
   }

   return wasNew;
}
deleteByKey ::= function (trie, key) {
   if (trie.root === null) {
      return false;
   }

   let didDelete = false;

   function deleteFrom(node) {
      let {at} = $.nodeKeyPlace(node, key, trie.cmp);
      
      if (at === undefined) {
         return node;
      }
      
      if (node.isLeaf) {
         if (node.length === 1) {
            return null;  // it was the only item in the whole trie
         }

         let newNode = $.freshNode(node);
         newNode.splice(at, 1);
         didDelete = true;
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
            newSub.splice(neighbor < at ? 0 : newSub.length, 0, ...node[neighbor]);
            
            // If 'node' is the root, it's possible that 'node.length == 2'. This is how
            // the tree may shorten at all.
            if (node.length === 2) {
               return newSub;
            }
            
            let newNode = $.freshNode(node);
            newNode.splice(at, 1, newSub);
            newNode.splice(neighbor, 1);
            
            return newNode;
         }
      }

      if (newSub === oldSub) {
         return node;
      }
      
      let newNode = $.freshNode(node);
      newNode.splice(at, 1, newsub);
      
      return newNode;
   }
   
   trie.root = deleteFrom(trie.root);

   return didDelete;
}
isNodeFull ::= function (node) {
   return node.length === $.MAX_NODE_SIZE;
}
nodeKeyPlace ::= function (node, key, cmp) {
   let i = 0;
   let j = node.length - 1;
   
   while (i <= j) {
      let k = (i + j) >> 1;
      let subnode = node[k];
      let least, greatest;
      
      // actually, the subnodes will either be all items or all nodes
      if (node.isLeaf) {
         least = greatest = subnode;
      }
      else {
         least = subnode.least;
         greatest = subnode.greatest;
      }
      
      if (cmp(key, least) < 0) {
         j = k - 1;
      }
      else if (cmp(key, greatest) > 0) {
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
makeNode ::= function (array, isLeaf) {
   array.isLeaf = isLeaf;
   array.isFresh = true;

   if (isLeaf) {
      Object.defineProperties(array, {
         least: {
            get: function () { return this[0] }
         },
         greatest: {
            get: function () { return this[this.length - 1] }
         }
      });
   }
   else {
      Object.defineProperties(array, {
         least: {
            get: function () { return this[0].least }
         },
         greatest: {
            get: function () { return this[this.length - 1].greatest }
         }
      });
   }
}
maybeSplit ::= function (node) {
   $.assert(node.isFresh);

   if (node.length > $.MAX_NODE_SIZE) {
      // 'node' itself is expected to be freshly created, even if we're dealing with an
      // immutable trie. So we can mutate it now.
      let Rnode = node.splice(node.length >> 1, node.length);
         
      $.makeNode(Rnode, node.isLeaf);
         
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
   $.makeNode(newNode, node.isLeaf);
   return newNode;
}
