common
   assert
   check
   breadthExpansion
   leastBy
   Queue
   map

set-map
   setDefault
   addAll
   deleteAll

multi-set
   MultiSet

-----

*** High-level interface ***

ref ::=
   function (from, to) {
      if ($.obj2node.has(from)) {
         let nFrom = $.obj2node.get(from);
         let nTo = $.obj2node.get(to);

         if (nTo !== undefined) {
            $.connectNodes(nFrom, nTo);
         }
         else {
            nTo = $.installNodeFor(to, nFrom);
            $.connectNodes(nFrom, nTo);
            $.attachReachable(nTo);
         }
      }
      else {
         $.setDefault($.obj2refs, from, () => new $.MultiSet).add(to);
      }
   }


unref ::=
   function (from, to) {
      if ($.obj2node.has(from)) {
         let nFrom = $.obj2node.get(from);
         let nTo = $.obj2node.get(to);

         $.unconnectNodes(nFrom, nTo);

         if (nTo.parentNode === nFrom) {
            nTo.parentNode = null;

            $.fixOrphanedSubtree(nTo);
            return;
         }
      }
      else {
         $.obj2refs.get(from).remove(to);
      }
   }


reref ::=
   function (from, objNo, objYes) {
      if (objNo === objYes) {
         return;
      }

      $.ref(from, objYes);
      $.unref(from, objNo);
   }


addRoot ::=
   function (object) {
      $.ref($.rootObj, object);
   }


removeRoot ::=
   function (object) {
      $.unref($.rootObj, object);
   }


isAlive ::=
   function (object) {
      return $.obj2node.has(object);
   }


isDead ::=
   function (object) {
      return !$.isAlive(object);
   }


*** Nodes, trees, operations on them

obj2node ::=
   :Map an object to its node in the graph.

    NOTE: a node is created only when an object becomes reachable from the root. Until this point,
    we remember "ref" connections between objects in the 'obj2refs' data structure.

   new Map


obj2refs ::=
   :Map an object to the set of objects it references.

    This is used before the object is attached to the graph. Once it becomes attached, the object
    gets deleted from 'obj2refs', and it is allocated a node in 'obj2node'.

   new WeakMap


rootObj ::=
   :Virtual root object. Only needed to satisfy the general case of our algorithms.

   new Object


root ::= 
   :Virtual root node. The only node whose .parentNode === null.

   $.installNodeFor($.rootObj, null)


installNodeFor ::=
   function (object, parentNode) {
      $.assert(() => !$.obj2node.has(object));

      let node = {
         object,
         parentNode,
         toObjects: $.setDefault($.obj2refs, object, () => new $.MultiSet),
         fromNodes: new Set,
      };

      $.obj2node.set(object, node);

      return node;
   }


connectNodes ::=
   function (nFrom, nTo) {
      nFrom.toObjects.add(nTo.object);
      nTo.fromNodes.add(nFrom);
   }


unconnectNodes ::=
   function (nFrom, nTo) {
      let isGone = nFrom.toObjects.remove(nTo.object);

      if (isGone) {
         nTo.fromNodes.delete(nFrom);
      }
   }


childNodes ::=
   function* (node) {
      for (let childObj of node.toObjects) {
         let childNode = $.obj2node.get(childObj);

         if (childNode.parentNode === node) {
            yield childNode;
         }
      }
   }


attachReachable ::=
   function (subroot) {
      let belt = $.Queue.new();

      $.Queue.put(belt, subroot);

      while (!$.Queue.isEmpty(belt)) {
         let fromNode = $.Queue.take(belt);

         for (let toObj of fromNode.toObjects) {
            let toNode = $.obj2node.get(toObj);

            if (toNode === undefined) {
               toNode = $.installNodeFor(toObj, fromNode);
               $.Queue.put(belt, toNode);
            }

            toNode.fromNodes.add(fromNode);
         }
      }
   }


fixOrphanedSubtree ::=
   :Fix a subtree whose root has been disconnected from the spanning tree

   function (subroot) {
      $.assert(() => subroot.parentNode === null);

      // Look whether 'subroot' can be easily hung up at another spot
      let newParent = $.leastBy(subroot.fromNodes, {
         keyOf: (node) => {
            let depth = 0;

            while (node !== subroot && node !== $.root) {
               node = node.parentNode;
               depth += 1;
            }

            return node === $.root ? depth : Infinity;
         },
         minimum: 0
      });

      if (newParent !== undefined) {
         subroot.parentNode = newParent;
         return;
      }

      // Could not easily rehang 'subroot'. Seek for the full garbage node set.
      let subrootChildren = Array.from($.childNodes(subroot))
      let belt = $.Queue.new(subrootChildren);
      let deadCandidates = new Set(subrootChildren);

      deadCandidates.add(subroot);

      while (!$.Queue.isEmpty(belt)) {
         let candidate = $.Queue.take(belt);

         if (!deadCandidates.has(candidate)) {
            continue;
         }

         let parent = $.leastBy(candidate.fromNodes, {
            keyOf: (node) => {
               let depth = 0;

               while (node !== $.root && !deadCandidates.has(node)) {
                  node = node.parentNode;
                  depth += 1;
               }

               return node === $.root ? depth : Infinity;
            },
            minimum: 0
         });

         if (parent !== undefined) {
            candidate.parentNode = parent;
            deadCandidates.delete(candidate);

            $.breadthExpansion(candidate, function* (node) {
               for (let child of $.childNodes(node)) {
                  if (deadCandidates.has(child)) {
                     child.parentNode = node;
                     deadCandidates.delete(child);

                     yield child;
                  }
               }
            })
         }
         else {
            for (let child of $.childNodes(candidate)) {
               $.Queue.put(belt, child);
               deadCandidates.add(child);
            }
         }
      }

      // Now whatever left in 'deadCandidates' is really dead
      let deadObjects = new Set($.map(deadCandidates, node => node.object))

      $.deleteAll($.obj2node, deadObjects);

      for (let dead of deadObjects) {
         $.freeDead(dead, deadObjects);
      }
   }


freeDead ::=
   function (object) {
      // console.log("Freeing object:", object);
   }
