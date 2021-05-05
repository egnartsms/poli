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
   let root = items === null ? [] : Array.from(items);
   $.makeNode(root, true);

   while (root.length > $.MAX_NODE_LEN) {
      root = $.splitNode(root);
      $.makeNode(root, false);
   }

   let vec = $.newObj($.proto, {root});
   $.freeze(vec);
   return vec;
}
size ::= function (vec) {
   return vec.root.size;
}
isMutated ::= function (vec) {
   return vec.root.isFresh;
}
copy ::= function (vec) {
   $.freeze(vec);
   return $.newObj($.proto, {root: vec.root});
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
genSlice ::= function (vec, n) {
   return (function* gen(node, n) {
      if (node.isLeaf) {
         yield* node.slice(n);
      }
      else {
         let k = 0;
         while (k < node.length && node[k].size <= n) {
            n -= node[k].size;
            k += 1;
         }

         if (k < node.length) {
            yield* gen(node[k], n);
            k += 1;
            while (k < node.length) {
               yield* $.genSubtree(node[k]);
               k += 1;
            }
         }
      }
   })(vec.root, n);
}
at ::= function (vec, index) {
   let node = vec.root;

   while (!node.isLeaf) {
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
indexToMerge ::= function (parent, i) {
   $.assert(parent.length >= 2);

   let isLeft = (i > 0 && 
      (i + 1 === parent.length || parent[i + 1].length >= parent[i - 1].length)
   );

   return isLeft ? i - 1 : i;
}
redestributeBetween ::= function (lnode, rnode) {
   $.assert(lnode.isLeaf === rnode.isLeaf);

   let merged = [...lnode, ...rnode];
   $.makeNode(merged, lnode.isLeaf);
   return $.splitNode(merged);
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
modifyAt ::= function (vec, index, modifier) {
   function modify(node, index) {
      if (node.isLeaf) {
         let xnode = $.freshNode(node);
         modifier(xnode, index);
         xnode.size = xnode.length;
         return xnode;
      }
      else {
         let k = 0;

         while (k < node.length - 1 && node[k].size <= index) {
            index -= node[k].size;
            k += 1;
         }

         let xnode = $.freshNode(node);
         let sub = xnode[k];
         let oldSubSize = sub.size;
         let xsub = modify(sub, index);

         xnode[k] = xsub;
         xnode.size += xsub.size - oldSubSize;         

         if (xsub.length > $.MAX_NODE_LEN) {
            xnode.splice(k, 1, ...$.splitNode(xsub));
         }
         else if (xsub.length < $.MIN_NODE_LEN) {
            let i = $.indexToMerge(xnode, k);
            xnode.splice(i, 2, ...$.redestributeBetween(xnode[i], xnode[i + 1]));
         }
         
         return xnode;
      }
   }

   let xroot = modify(vec.root, index);
   
   if (xroot.length > $.MAX_NODE_LEN) {
      let chunks = $.splitNode(xroot);
      xroot = chunks;
      $.makeNode(xroot, false);
   }
   else if (!xroot.isLeaf && xroot.length === 1) {
      [xroot] = xroot;
   }

   vec.root = xroot;
}
checkIndex ::= function (ok) {
   if (!ok) {
      throw new Error(`Vector index out of range`);
   }
}
pushBack ::= function (vec, item) {
   $.modifyAt(vec, vec.size, (leaf) => {
      leaf.push(item);
   });
}
insertAt ::= function (vec, at, item) {
   $.checkIndex(at >= 0 && at <= $.size(vec));

   $.modifyAt(vec, at, (leaf, i) => {
      leaf.splice(i, 0, item);
   });
}
deleteAt ::= function (vec, at) {
   $.checkIndex(at >= 0 && at < $.size(vec));
   
   $.modifyAt(vec, at, (leaf, i) => {
      leaf.splice(i, 1);
   });
}
setAt ::= function (vec, at, item) {
   $.checkIndex(at >= 0 && at < $.size(vec));

   $.modifyAt(vec, at, (leaf, i) => {
      leaf[i] = item;
   });
}
update ::= function (vec, fn, ...restArgs) {
   let xvec = $.copy(vec);
   fn(xvec, ...restArgs);
   return xvec;
}
