common
   assert
-----
MAX_NODE_LEN ::= 16
MIN_NODE_LEN ::= 8
proto ::= ({
   [Symbol.iterator] () {
      return $.items(this);
   }
})
Trie ::= function ({keyof, less}) {
   return Object.assign(Object.create($.proto), {
      keyof,
      less,
      root: null
   });
}
size ::= function (trie) {
   return trie.root === null ? 0 : trie.root.size;
}
isMutated ::= function (trie) {
   return trie.root !== null && trie.root.isFresh;
}
newIdentity ::= function (trie) {
   if ($.isMutated(trie)) {
      throw new Error(`Attempt to copy the identity of a mutated Trie`);
   }

   return Object.assign(Object.create($.Trie.prototype), trie);
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
find ::= function (trie, key) {
   if (trie.root === null ||
         trie.less(key, trie.root.minKey) ||
         trie.less(trie.root.maxKey, key)) {
      return undefined;
   }
   
   return (function findIn(node) {
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      if (at === undefined) {
         return undefined;
      }
      
      if (node.isLeaf) {
         return node[at];
      }
      else {
         return findIn(node[at]);
      }
   })(trie.root);
}
has ::= function (trie, key) {
   return $.find(trie, key) !== undefined;
}
add ::= function (trie, item) {
   if (trie.root === null) {
      trie.root = [item];
      trie.root.isFresh = true;
      trie.root.isLeaf = true;
      trie.root.minKey = trie.root.maxKey = trie.keyof(item);
      trie.root.size = 1;
      
      return true;  // was new
   }

   let wasNew;
   let itemKey = trie.keyof(item);

   function addTo(node) {
      return (node.isLeaf ? addToLeaf : addToInterior)(node);
   }   

   function addToLeaf(node) {
      let xnode = $.freshNode(node);
      let {at, right} = $.nodeKeyPlace(trie, xnode, itemKey);
      let minAffected, maxAffected;

      if (at !== undefined) {
         wasNew = false;
         minAffected = at === 0;
         maxAffected = at === xnode.length - 1;
         
         xnode.splice(at, 1, item);
      }
      else {
         wasNew = true;
         minAffected = right === 0;
         maxAffected = right === xnode.length;
         
         xnode.splice(right, 0, item);
      }

      xnode.size = xnode.length;

      if (minAffected) {
         xnode.minKey = trie.keyof(xnode[0]);
      }
      if (maxAffected) {
         xnode.maxKey = trie.keyof(xnode[xnode.length - 1]);
      }
      
      return xnode;      
   }

   function addToInterior(node) {
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
      
      let xnode = $.freshNode(node);
      let minAffected = index === 0;
      let maxAffected = index === xnode.length - 1;
      let sub = xnode[index];
      let oldSubSize = sub.size;
      let xsub = addTo(sub);  // remember, xsub may be === sub or not

      if (xsub.length > $.MAX_NODE_LEN) {
         let [lsub, rsub] = $.splitNode(trie, xsub);
         xnode.splice(index, 1, lsub, rsub);
      }
      else if (xsub !== sub) {
         xnode.splice(index, 1, xsub);
      }

      xnode.size += xsub.size - oldSubSize;

      if (minAffected) {
         xnode.minKey = xnode[0].minKey;
      }
      if (maxAffected) {
         xnode.maxKey = xnode[xnode.length - 1].maxKey;
      }

      return xnode;
   }

   let xroot = addTo(trie.root);

   if (xroot.length > $.MAX_NODE_LEN) {
      let lsub, rsub;

      [lsub, rsub] = xroot = $.splitNode(trie, xroot);
      xroot.isFresh = true;
      xroot.isLeaf = false;
      xroot.size = lsub.size + rsub.size;
      xroot.minKey = lsub.minKey;
      xroot.maxKey = rsub.maxKey;
   }

   trie.root = xroot;

   return wasNew;
}
removeByKey ::= function (trie, key) {
   if (trie.root === null) {
      return false;
   }

   let didRemove = false;

   function removeFromLeaf(node, at) {
      didRemove = true;

      let xnode = $.freshNode(node);
      
      xnode.splice(at, 1);
      xnode.size = xnode.length;

      if (xnode.length === 0) {
         xnode.minKey = xnode.maxKey = null;
      }
      else {
         if (at === 0) {
            xnode.minKey = trie.keyof(xnode[0]);
         }
         if (at === xnode.length) {
            xnode.maxKey = trie.keyof(xnode[xnode.length - 1]);
         }
      }
      
      return xnode;
   }

   function removeFromInterior(node, at) {
      let sub = node[at];
      let oldSubSize = sub.size;
      let xsub = removeFrom(sub);
      let deltaSize = xsub.size - oldSubSize;
      
      if (deltaSize === 0) {
         return node;
      }

      let xnode = $.freshNode(node);
      xnode.size += deltaSize;

      if (xsub !== sub) {
         xnode[at] = xsub;
      }

      if (xsub.length < $.MIN_NODE_LEN) {
         let i = $.indexToMerge(xnode, at);
         
         let minAffected = (i === 0);
         let maxAffected = i + 2 === xnode.length;
         let newSubs = $.redestributeBetween(xnode[i], xnode[i + 1]);

         xnode.splice(i, 2, ...newSubs);

         if (minAffected) {
            xnode.minKey = xnode[0].minKey;
         }
         if (maxAffected) {
            xnode.maxKey = xnode[xnode.length - 1].maxKey;
         }
      }
      else {
         if (at === 0) {
            xnode.minKey = xnode[0].minKey;
         }
         if (at + 1 === xnode.length) {
            xnode.maxKey = xnode[xnode.length - 1].maxKey;
         }
      }
      
      return xnode;
   }

   function removeFrom(node) {
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      return (at === undefined)
         ? node
         : (node.isLeaf ? removeFromLeaf : removeFromInterior)(node, at);
   }
   
   let xroot = removeFrom(trie.root);

   if (xroot.isLeaf) {
      if (xroot.length === 0) {
         xroot = null;
      }
   }
   else {
      if (xroot.length === 1) {
         xroot = xroot[0];
      }
   }

   trie.root = xroot;

   return didRemove;
}
remove ::= function (trie, item) {
   return $.removeByKey(trie, trie.keyof(item));
}
isNodeFull ::= function (node) {
   return node.length === $.MAX_NODE_LEN;
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
indexToMerge ::= function (parent, i) {
   $.assert(parent.length >= 2);

   let isLeft = (i > 0 && 
      (i + 1 === parent.length || parent[i + 1].length >= parent[i - 1].length)
   );

   return isLeft ? i - 1 : i;
}
minKeyOf ::= function (trie, node) {
   return node.isLeaf ? trie.keyof(node[0]) : node[0].minKey;
}
maxKeyOf ::= function (trie, node) {
   return node.isLeaf ? trie.keyof(node[node.length - 1]) : node[node.length - 1].maxKey;
}
sizeOf ::= function (node) {
   return node.isLeaf ? node.length : $.totalSize(node);
}
totalSize ::= function (nodes) {
   return nodes.reduce((sum, nd) => sum + nd.size, 0);
}
splice ::= function (trie, node, index, deleteCount, ...insert) {
   let firstAffected = (index === 0);
   let lastAffected = (index + deleteCount >= node.length);
   let result = node.splice(index, deleteCount, ...insert);

   if (firstAffected) {
      node.minKey = $.minKeyOf(trie, node);
   }   
   if (lastAffected) {
      node.maxKey = $.maxKeyOf(trie, node);
   }

   return result;
}
splitNode ::= function (trie, node) {
   $.assert(node.length > $.MAX_NODE_LEN);
   $.assert(node.length <= 2 * $.MAX_NODE_LEN);  // no need to handle this

   let lnode = node.slice(0, node.length >> 1);
   let rnode = node.slice(node.length >> 1);
   
   lnode.isFresh = true;
   lnode.isLeaf = node.isLeaf;
   lnode.minKey = node.minKey;
   lnode.maxKey = $.maxKeyOf(trie, lnode);
   lnode.size = $.sizeOf(lnode);

   rnode.isFresh = true;
   rnode.isLeaf = node.isLeaf;
   rnode.minKey = $.minKeyOf(trie, rnode);
   rnode.maxKey = node.maxKey;
   rnode.size = $.sizeOf(rnode);

   return [lnode, rnode];
}
redestributeBetween ::= function (lnode, rnode) {
   $.assert(lnode.isLeaf === rnode.isLeaf);

   let merged = [...lnode, ...rnode];

   merged.isFresh = true;
   merged.isLeaf = lnode.isLeaf;
   merged.size = lnode.size + rnode.size;
   merged.minKey = lnode.minKey;
   merged.maxKey = rnode.maxKey;

   if (merged.length > $.MAX_NODE_LEN) {
      return $.splitNode(merged);
   }
   else {
      return [merged];
   }
}
freshNode ::= function (node) {
   if (node.isFresh) {
      return node;
   }

   let xnode = Array.from(node);

   xnode.isFresh = true;
   xnode.isLeaf = node.isLeaf;
   xnode.minKey = node.minKey;
   xnode.maxKey = node.maxKey;
   xnode.size = node.size;

   return xnode;
}
