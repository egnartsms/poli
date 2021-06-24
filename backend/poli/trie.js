common
   assert
   newObj
   lessThan
   map
-----
MAX_NODE_LEN ::= 16
MIN_NODE_LEN ::= 8
emptyRoot ::= function () {
   return Object.assign([], {
      isLeaf: true,
      isFresh: true,
      minKey: null,
      maxKey: null,
      size: 0
   });
}
isEmpty ::= function (trie) {
   return trie.root.size === 0;
}
freeze ::= function (root) {
   // Mark all fresh nodes as non-fresh
   if (!root.isFresh) {
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

   freeze(root);
}
items ::= function* (root) {
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
   
   yield* subtree(root);
}
nodeKeyPlace ::= function (node, key, opts) {
   let i = 0;
   let j = node.length - 1;
   
   while (i <= j) {
      let k = (i + j) >> 1;
      let loKey, hiKey;
      
      // actually, the subnodes will either be all items or all nodes
      if (node.isLeaf) {
         loKey = hiKey = opts.keyof(node[k]);
      }
      else {
         loKey = node[k].minKey;
         hiKey = node[k].maxKey;
      }
      
      if (opts.less(key, loKey)) {
         j = k - 1;
      }
      else if (opts.less(hiKey, key)) {
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
minKeyOf ::= function (node, keyof) {
   return node.isLeaf ? keyof(node[0]) : node[0].minKey;
}
maxKeyOf ::= function (node, keyof) {
   return node.isLeaf ? keyof(node[node.length - 1]) : node[node.length - 1].maxKey;
}
sizeOf ::= function (node) {
   return node.isLeaf ? node.length : $.totalSize(node);
}
totalSize ::= function (nodes) {
   return nodes.reduce((sum, nd) => sum + nd.size, 0);
}
splitNode ::= function (node, keyof) {
   $.assert(node.length > $.MAX_NODE_LEN);
   $.assert(node.length <= 2 * $.MAX_NODE_LEN);  // no need to handle this

   let lnode = node.slice(0, node.length >> 1);
   let rnode = node.slice(node.length >> 1);
   
   lnode.isFresh = true;
   lnode.isLeaf = node.isLeaf;
   lnode.minKey = node.minKey;
   lnode.maxKey = $.maxKeyOf(lnode, keyof);
   lnode.size = $.sizeOf(lnode);

   rnode.isFresh = true;
   rnode.isLeaf = node.isLeaf;
   rnode.minKey = $.minKeyOf(rnode, keyof);
   rnode.maxKey = node.maxKey;
   rnode.size = $.sizeOf(rnode);

   return [lnode, rnode];
}
redestributeBetween ::= function (lnode, rnode, keyof) {
   $.assert(lnode.isLeaf === rnode.isLeaf);

   let merged = [...lnode, ...rnode];

   merged.isFresh = true;
   merged.isLeaf = lnode.isLeaf;
   merged.size = lnode.size + rnode.size;
   merged.minKey = lnode.minKey;
   merged.maxKey = rnode.maxKey;

   if (merged.length > $.MAX_NODE_LEN) {
      return $.splitNode(merged, keyof);
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
itemAt ::= function (root, key, opts) {
   let node = root;

   for (;;) {
      let {at} = $.nodeKeyPlace(node, key, opts);
      
      if (at === undefined) {
         return undefined;
      }
      
      if (node.isLeaf) {
         return node[at];
      }
      
      node = node[at];
   }
}
addItem ::= function (root, item, opts, replace=true) {
   let itemKey = opts.keyof(item);

   function addTo(node) {
      return (node.isLeaf ? addToLeaf : addToInterior)(node);
   }   

   function addToLeaf(node) {
      let {at, right} = $.nodeKeyPlace(node, itemKey, opts);
      let shouldAdd = (typeof replace !== 'function') ?
         Boolean(replace) :
         replace(at === undefined ? undefined : node[at]);

      if (!shouldAdd) {
         return node;
      }

      let xnode = $.freshNode(node);
      let minAffected, maxAffected;

      if (at !== undefined) {
         minAffected = at === 0;
         maxAffected = at === xnode.length - 1;
         
         xnode.splice(at, 1, item);
      }
      else {
         minAffected = right === 0;
         maxAffected = right === xnode.length;
         
         xnode.splice(right, 0, item);
      }

      xnode.size = xnode.length;

      if (minAffected) {
         xnode.minKey = opts.keyof(xnode[0]);
      }
      if (maxAffected) {
         xnode.maxKey = opts.keyof(xnode[xnode.length - 1]);
      }
      
      return xnode;      
   }

   function addToInterior(node) {
      let index;
      let {at, left, right} = $.nodeKeyPlace(node, itemKey, opts);
      
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
         let [lsub, rsub] = $.splitNode(xsub, opts.keyof);
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

   let xroot = addTo(root);

   if (xroot.length > $.MAX_NODE_LEN) {
      let lsub, rsub;

      xroot = [lsub, rsub] = $.splitNode(xroot, opts.keyof);
      xroot.isFresh = true;
      xroot.isLeaf = false;
      xroot.size = lsub.size + rsub.size;
      xroot.minKey = lsub.minKey;
      xroot.maxKey = rsub.maxKey;
   }

   return xroot;
}
removeItemAt ::= function (root, key, opts) {
   function removeFromLeaf(node, at) {
      let xnode = $.freshNode(node);
      
      xnode.splice(at, 1);
      xnode.size = xnode.length;

      if (xnode.length === 0) {
         xnode.minKey = xnode.maxKey = null;
      }
      else {
         if (at === 0) {
            xnode.minKey = opts.keyof(xnode[0]);
         }
         if (at === xnode.length) {
            xnode.maxKey = opts.keyof(xnode[xnode.length - 1]);
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

      let minAffected, maxAffected;

      if (xsub.length < $.MIN_NODE_LEN) {
         let i = $.indexToMerge(xnode, at);
         minAffected = (i === 0);
         maxAffected = i + 2 === xnode.length;
         let newSubs = $.redestributeBetween(xnode[i], xnode[i + 1], opts.keyof);
         xnode.splice(i, 2, ...newSubs);
      }
      else {
         minAffected = (at === 0);
         maxAffected = (at + 1 === xnode.length);
      }

      if (minAffected) {
         xnode.minKey = xnode[0].minKey;
      }
      if (maxAffected) {
         xnode.maxKey = xnode[xnode.length - 1].maxKey;
      }
      
      return xnode;
   }

   function removeFrom(node) {
      let {at} = $.nodeKeyPlace(node, key, opts);
      
      return (at === undefined)
         ? node
         : (node.isLeaf ? removeFromLeaf : removeFromInterior)(node, at);
   }
   
   let xroot = removeFrom(root);

   if (!xroot.isLeaf && xroot.length === 1) {
      xroot = xroot[0];
   }

   return xroot;
}
Map ::= function (less=$.lessThan) {
   return $.newObj($.protoMap, {
      keyof: ([key, val]) => key,
      less: less,
      root: $.emptyRoot()
   });
}
protoMap ::= ({
   [Symbol.for('poli.trie.valueOf')] (item) {
      return item[1];
   },

   [Symbol.iterator] () {
      return $.items(this.root);
   }
})
KeyedSet ::= function (keyof, less=$.lessThan) {
   return $.newObj($.protoKeyedSet, {
      keyof: keyof,
      less: less,
      root: $.emptyRoot()
   });
}
protoKeyedSet ::= ({
   [Symbol.for('poli.trie.valueOf')] (item) {
      return item;
   },

   [Symbol.iterator] () {
      return $.items(this.root);
   }
})
size ::= function (trie) {
   return trie.root.size;
}
keysEqual ::= function (key1, key2, trie) {
   return !trie.less(key1, key2) && !trie.less(key2, key1);
}
throwKeyError ::= function (key) {
   throw new Error(`Trie key missing: '${key}'`);
}
valueOf ::= function (trie, item) {
   return trie[Symbol.for('poli.trie.valueOf')](item);
}
ikeys ::= function (trie) {
   let itor = $.map($.items(trie.root), trie.keyof);

   return !trie.root.isFresh ? itor : Array.from(itor)[Symbol.iterator]();
}
ivalues ::= function (trie) {
   let itor = $.map($.items(trie.root), item => $.valueOf(trie, item));

   return !trie.root.isFresh ? itor : Array.from(itor)[Symbol.iterator]();
}
valuesArray ::= function (trie) {
   return Array.from($.items(trie.root), item => $.valueOf(trie, item));
}
at ::= function (trie, key, ifmissing) {
   let item = $.itemAt(trie.root, key, trie);
   if (item === undefined) {
      if (ifmissing !== undefined) {
         return ifmissing();
      }
      $.throwKeyError(key);
   }
   else
      return $.valueOf(trie, item);
}
atOr ::= function (trie, key, dfault) {
   let item = $.itemAt(trie.root, key, trie);
   return item === undefined ? dfault : $.valueOf(trie, item);
}
copy ::= function (trie) {
   $.freeze(trie.root);
   return $.newObj(Object.getPrototypeOf(trie), trie);
}
has ::= function (keyedSet, item) {
   return $.hasAt(keyedSet, keyedSet.keyof(item));
}
hasAt ::= function (trie, key) {
   return $.itemAt(trie.root, key, trie) !== undefined;
}
addNew ::= function (keyedSet, item) {
   keyedSet.root = $.addItem(keyedSet.root, item, keyedSet, (oldval) => {
      if (oldval !== undefined) {
         throw new Error(`KeyedSet item to be added is already there: ${item}`);
      }
      return true;
   });
}
removeExisting ::= function (keyedSet, item) {
   let oldSize = keyedSet.root.size;
   let xroot = $.removeAt(keyedSet.root, keyedSet.keyof(item), keyedSet);

   if (xroot.size === oldSize) {
      throw new Error(`KeyedSet item to be removed is not there: ${item}`);
   }
   
   keyedSet.root = xroot;
}
setAt ::= function (map, key, val) {
   map.root = $.addItem(map.root, [key, val], map);
}
setNewAt ::= function (map, key, val) {
   map.root = $.addItem(map.root, [key, val], map, (oldval) => {
      if (oldval !== undefined) {
         throw new Error(`Map key to be added is already there: ${key}`);
      }
      return true;
   });
}
removeAt ::= function (map, key) {
   map.root = $.removeItemAt(map.root, key, map);
}
removeExistingAt ::= function (map, key) {
   let oldSize = map.root.size;
   let xroot = $.removeItemAt(map.root, key, map);

   if (xroot.size === oldSize) {
      throw new Error(`Map key to be removed is not there: ${key}`);
   }

   map.root = xroot;
}
equal ::= function (ksA, ksB, itemsEqual) {
   if ($.size(ksA) !== $.size(ksB)) {
      return false;
   }

   function treesEqual(nodeA, nodeB) {
      if (nodeA.isLeaf !== nodeB.isLeaf || nodeA.length !== nodeB.length) {
         return false;
      }

      let fnequal = nodeA.isLeaf ? itemsEqual : treesEqual;

      for (let i = 0; i < nodeA.length; i += 1) {
         if (!fnequal(nodeA[i], nodeB[i])) {
            return false;
         }
      }

      return true;
   }
}