common
   assert
   newObj
-----
MAX_NODE_LEN ::= 16
MIN_NODE_LEN ::= 8
proto ::= ({
   [Symbol.iterator] () {
      return $.items(this);
   }
})
Vector ::= function (items=null) {
   if (items === null) {
      return $.newObj($.proto, {root: null});
   }

   let root = Array.from(items);
   if (root.length === 0) {
      return $.newObj($.proto, {root: null});
   }

   $.makeNode(root, true);

   while (root.length > $.MAX_NODE_LEN) {
      root = $.splitNode(root);
      $.makeNode(root, false);
   }

   return $.newObj($.proto, {root});
}
size ::= function (vec) {
   return vec.root === null ? 0 : vec.root.size;
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
genSubtree ::= function* genSubtree(node) {
   if (node.isLeaf) {
      yield* node;
   }
   else {
      for (let subnode of node) {
         yield* genSubtree(subnode);
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
         let sub = xnode[xnode.length - 1];
         let oldSubSize = sub.size;
         let xsub = pushTo(sub);
         let deltaSize = xsub.size - oldSubSize;
         
         $.assert(deltaSize === 1);

         if (xsub.length > $.MAX_NODE_LEN) {
            xnode.splice(xnode.length - 1, 1, ...$.splitNode(xsub));
         }
         else if (xsub !== sub) {
            xnode.splice(xnode.length - 1, 1, xsub);
         }
         
         xnode.size += deltaSize;
      }

      return xnode;
   }

   let xroot = pushTo(vec.root);
   
   if (xroot.length > $.MAX_NODE_LEN) {
      let chunks = $.splitNode(xroot);
      xroot = chunks;
      $.makeNode(xroot, false);
   }

   vec.root = xroot;
}
splitNode ::= function (node) {
   $.assert(node.isFresh);
   
   if (node.length <= $.MAX_NODE_LEN) {
      return [node];
   }

   let chunks = [];
   let k = 0;

   while (node.length - k > 2 * $.MAX_NODE_LEN) {
      let chunk = node.slice(k, k + $.MAX_NODE_LEN);
      $.makeNode(chunk, node.isLeaf);
      chunks.push(chunk);
      k += $.MAX_NODE_LEN;
   }

   if (node.length - k > $.MAX_NODE_LEN) {
      let m = (k + node.length) >> 1;
      
      let Lchunk = node.slice(k, m);
      $.makeNode(Lchunk, node.isLeaf);
      chunks.push(Lchunk);
      
      let Rchunk = node.slice(m);
      $.makeNode(Rchunk, node.isLeaf);
      chunks.push(Rchunk);
   }

   return chunks;
}
freshNode ::= function (node) {
   if (node.isFresh) {
      return node;
   }

   let xnode = Array.from(node);

   xnode.isFresh = true;
   xnode.isLeaf = node.isLeaf;
   xnode.size = node.size;

   return xnode;
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
   let xvec = $.newIdentity(vec);
   fnMutator(xvec);
   $.freeze(xvec);
   return xvec;
}