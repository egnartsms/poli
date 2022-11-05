common
   check
   breadthExpansion
   leastBy

set-map
   setDefault

-----

obj2node ::= new Map


root ::=
   {
      parent: null,
      children: new Set,
      outgoing: new Set,
   }


deadCallback ::=
   null


setDeadCallback ::=
   function (callback) {
      $.deadCallback = callback;
   }


makeNode ::=
   function (object) {
      return {
         parent: null,
         children: new Set,
         ingoing: new Set,
         outgoing: new Set,
         object
      }
   }


ensureNodeFor ::=
   function (object) {
      return $.setDefault($.obj2node, object, () => $.makeNode(object));
   }


connectParentChild ::=
   function (parent, child) {
      if (child.parent !== null) {
         $.unconnectFromParent(child);
      }

      parent.children.add(child);
      child.parent = parent;
   }


unconnectFromParent ::=
   function (node) {
      node.parent.children.delete(node);
      node.parent = null;
   }


connectNodes ::=
   function (nFrom, nTo) {
      if (nTo.parent === null) {
         $.connectParentChild(nFrom, nTo);
      }

      $.check(!nFrom.outgoing.has(nTo));
      $.check(!nTo.ingoing.has(nFrom));

      nFrom.outgoing.add(nTo);
      nTo.ingoing.add(nFrom);
   }


unconnectNodes ::=
   function (nFrom, nTo) {
      $.check(nFrom.outgoing.has(nTo));
      $.check(nTo.ingoing.has(nFrom));

      nFrom.outgoing.delete(nTo);
      nTo.ingoing.delete(nFrom);

      if (nTo.parent === nFrom) {
         $.unconnectFromParent(nTo);
      }
   }


addRoot ::=
   function (object) {
      $.connectNodes($.root, $.ensureNodeFor(object));
   }


link ::=
   function (from, to) {
      let nFrom = $.ensureNodeFor(from);
      let nTo = $.ensureNodeFor(to);

      $.connectNodes(nFrom, nTo);
   }


linkN ::=
   function (from, toMany) {
      let nFrom = $.ensureNodeFor(from);

      for (let to of toMany) {
         $.connectNodes(nFrom, $.ensureNodeFor(to));
      }
   }


unlink ::=
   function (from, to) {
      let nFrom = $.obj2node.get(from);
      let nTo = $.obj2node.get(to);

      $.unconnectNodes(nFrom, nTo);

      if (nTo.parent === null) {
         $.fixOrphanedSubtree(nTo);
      }
   }


relink ::=
   function (from, objNo, objYes) {
      if (objNo === objYes) {
         return;
      }

      let nFrom = $.obj2node.get(from);
      let nNo = $.obj2node.get(objNo);
      let nYes = $.ensureNodeFor(objYes);

      $.unconnectNodes(nFrom, nNo);
      $.connectNodes(nFrom, nYes);

      if (nNo.parent === null) {
         $.fixOrphanedSubtree(nNo);
      }
   }


relinkN ::=
   function (from, objsNo, objsYes) {
      let nFrom = $.obj2node.get(from);
      let toRemove = new Set($.map(objsNo, obj => $.obj2node.get(obj)));
      let toAdd = new Set($.map(objsYes, obj => $.obj2node.get(obj)));

      $.deleteIntersection(toRemove, toAdd);

      for (let node of toRemove) {
         $.unconnectNodes(nFrom, node);
      }

      for (let node of toAdd) {
         $.connectNodes(nFrom, node);
      }

      for (let node of toRemove) {
         if (node.parent === null) {
            $.fixOrphanedSubtree(node);
         }
      }
   }


fixOrphanedSubtree ::=
   :Fix a subtree whose root has been disconnected from the spanning tree

   function (subroot) {
      $.check(subroot.parent === null);

      // Look whether 'subroot' can be easily hung up at another spot
      let newParent = $.leastBy(subroot.ingoing, (node) => {
         let depth = 0;

         while (node !== subroot && node !== $.root) {
            node = node.parent;
            depth += 1;
         }

         return node === subroot ? Infinity : depth;
      });

      if (newParent !== undefined) {
         $.connectParentChild(newParent, subroot);
         return;
      }

      // 'subroot' might be dead (unreachable), as well as some part of its subtree. Find exactly
      //  what is dead.
      let deadCandidates = new Set([subroot]);

      $.breadthExpansion({
         initial: subroot.children,
         genMore: function* (node) {
            let parent = $.leastBy(node.ingoing, (node) => {
               let depth = 0;

               while (node !== $.root && !deadCandidates.has(node)) {
                  node = node.parent;
                  depth += 1;
               }

               return deadCandidates.has(node) ? Infinity : depth;
            });

            if (parent !== undefined) {
               $.connectParentChild(parent, node);
            }
            else {
               deadCandidates.add(node);
               yield* node.children;
            }
         }
      });

      // Now we have deadCandidates. Determine which of them are actually dead.
      function pickOutRandomAlive() {
         for (let node of deadCandidates) {
            for (let parent of node.ingoing) {
               if (!deadCandidates.has(parent)) {
                  $.connectParentChild(parent, alive);
                  deadCandidates.delete(alive);

                  return alive;
               }
            }
         }

         return null;
      }

      while (deadCandidates.size > 0) {
         let alive = pickOutRandomAlive();

         if (alive === null) {
            // No alive found, all deadCandidates are really dead
            break;
         }

         // Now follow from alive and join to the tree everything from 'deadCandidates' that can be
         // reached from 'alive'
         $.breadthExpansion({
            initial: [alive],
            stopWhen: () => deadCandidates.size === 0,
            genMore: function* (node) {
               for (let sub of node.outgoing) {
                  if (deadCandidates.has(sub)) {
                     $.connectParentChild(node, sub);
                     deadCandidates.delete(sub);
                     yield sub;
                  }
               }
            }
         });
      }

      // Now whatever left in 'deadCandidates' is really dead. We should remove all outgoing
      // connections from dead objects. Ingoing connections can be only from another dead.
      for (let node of deadCandidates) {
         for (let out of node.outgoing) {
            $.unconnectNodes(node, out);
         }

         $.obj2node.delete(node.object);

         $.freeDead(node.object);
      }

      if ($.deadCallback !== null) {
         $.deadCallback(Array.from(deadCandidates, node => node.object));
      }
   }


freeDead ::=
   function (object) {
      // console.log("Freeing object:", object);
   }
