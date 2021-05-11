common
   assert
   newObj
   lessThan
   map
-----
MAX_NODE_LEN ::= 16
MIN_NODE_LEN ::= 8
proto ::= ({
   [Symbol.iterator] () {
      return $.items(this);
   }
})
Trie ::= function ({keyof, less, valof}) {
   return $.newObj($.proto, {
      keyof,
      less,
      valof,
      // used when the trie is nested into a higher-order structure
      isFresh: false,
      root: Object.assign([], {
         isLeaf: true,
         isFresh: true,
         minKey: null,
         maxKey: null,
         size: 0
      })
   });
}
size ::= function (trie) {
   return trie.root.size;
}
isEmpty ::= function (trie) {
   return trie.root.size === 0;
}
isMutated ::= function (trie) {
   return trie.root.isFresh;
}
copy ::= function (trie) {
   $.freeze(trie);
   return $.newObj($.proto, trie);
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
   
   yield* subtree(trie.root);
}
keys ::= function (trie) {
   return $.map($.items(trie), trie.keyof);
}
values ::= function (trie) {
   return $.map($.items(trie), trie.valof);
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
itemAt ::= function (trie, key) {
   let node = trie.root;

   for (;;) {
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      if (at === undefined) {
         return undefined;
      }
      
      if (node.isLeaf) {
         return node[at];
      }
      
      node = node[at];
   }
}
throwKeyError ::= function (key) {
   throw new Error(`Trie key missing: '${key}'`);
}
tryAt ::= function (trie, key) {
   let item = $.itemAt(trie, key);
   return item === undefined ? undefined : trie.valof(item);
}
at ::= function (trie, key, ifmissing=null) {
   let item = $.itemAt(trie, key);
   if (item === undefined) {
      if (ifmissing !== null) {
         return ifmissing();
      }
      $.throwKeyError(key);
   }
   else
      return trie.valof(item);
}
tryChain ::= function (trie, ...keys) {
   for (let key of keys) {
      if (trie === undefined) {
         break;
      }
      trie = $.tryAt(trie, key);
   }
   
   return trie;
}
has ::= function (trie, item) {
   return $.hasAt(trie, trie.keyof(item));
}
hasAt ::= function (trie, key) {
   return $.itemAt(trie, key) !== undefined;
}
hasChain ::= function (trie, ...keys) {
   let last = keys.length - 1;
   
   for (let i = 0; trie !== undefined && i < last; i += 1) {
      trie = $.tryAt(trie, keys[i]);
   }
   
   return trie !== undefined && $.hasAt(trie, keys[last]);
}
add ::= function (trie, item) {
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
         let [lsub, rsub] = $.splitNode(xsub, trie.keyof);
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

      xroot = [lsub, rsub] = $.splitNode(xroot, trie.keyof);
      xroot.isFresh = true;
      xroot.isLeaf = false;
      xroot.size = lsub.size + rsub.size;
      xroot.minKey = lsub.minKey;
      xroot.maxKey = rsub.maxKey;
   }

   trie.root = xroot;

   return wasNew;
}
addNew ::= function (trie, item) {
   let wasNew = $.add(trie, item);
   if (!wasNew) {
      throw new Error(`Trie item added was not new`);
   }
}
setAt ::= function (trie, key, val) {
   return $.add(trie, [key, val]);
}
discardAt ::= function (trie, key) {
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

      let minAffected, maxAffected;

      if (xsub.length < $.MIN_NODE_LEN) {
         let i = $.indexToMerge(xnode, at);
         minAffected = (i === 0);
         maxAffected = i + 2 === xnode.length;
         let newSubs = $.redestributeBetween(xnode[i], xnode[i + 1], trie.keyof);
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
      let {at} = $.nodeKeyPlace(trie, node, key);
      
      return (at === undefined)
         ? node
         : (node.isLeaf ? removeFromLeaf : removeFromInterior)(node, at);
   }
   
   let xroot = removeFrom(trie.root);

   if (!xroot.isLeaf && xroot.length === 1) {
      [xroot] = xroot;
   }

   trie.root = xroot;

   return didRemove;
}
removeAt ::= function (trie, key) {
   let didRemove = $.discardAt(trie, key);
   if (!didRemove) {
      $.throwKeyError(key);
   }
}
discard ::= function (trie, item) {
   return $.discardAt(trie, trie.keyof(item));
}
remove ::= function (trie, item) {
   $.removeAt(trie, trie.keyof(item));
}
Map ::= function () {
   return $.Trie({
      keyof: ([key, val]) => key,
      valof: ([key, val]) => val,
      less: $.lessThan
   })
}
KeyedSet ::= function (keyof) {
   return $.Trie({
      keyof,
      valof: item => item,
      less: $.lessThan
   })
}
makeEmpty ::= function () {
   return $.Map();
}
