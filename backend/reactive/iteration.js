import { methodFor } from '$/common/generic.js';
import * as typ from './typical-node.js';


function Iteration(coll, proc) {
   this.coll = coll;
   this.proc = proc;
   this.itemToNode = new Map;
   this.ver = null;

   for (let item of coll) {
      iterate(this, item);
   }

   coll.refBy(this);

   this.ver = coll.currentVersion();
}


function iterate(iter, item) {
   let context = lazyMountingContext(iter, item);

   doMounting(context, warnOnError(iter.proc.bind(null, item)));

   if (context.node !== null) {
      iter.itemToNode.set(item, context.node);
   }
}


methodFor(Iteration, {
   undo(reversibly) {
      for (let node of this.itemToNode.values()) {
         typ.dismantle(node, reversibly);
      }

      this.itemToNode.clear();
      this.ver = null;

      this.coll.unrefBy(this);
   },

   fulfill() {
      // An iteration may be scheduled for fulfillment but then fully undone. Check this.
      if (this.ver === null) {
         return;
      }

      this.ver.unchain(this.coll);

      for (let item of this.ver.removed) {
         if (this.itemToNode.has(item)) {
            let node = this.itemToNode.get(item);
            this.itemToNode.delete(item);
            typ.dismantle(node, false);
         }
      }

      for (let item of this.ver.added) {
         iterate(this, item);
      }

      this.ver = this.coll.currentVersion();
      this.coll.iterationFulfilled(this);
   }
});


/**
 * Iteration node
 */
function Node(iter, item) {
   this.iter = iter;
   this.item = item;
   this.deps = new Set;
   this.effects = [];
}


methodFor(Node, typ.dependOn);
methodFor(Node, typ.addEffect);


function lazyMountingContext(iter, item) {
   let node = null;

   function ensureNode() {
      if (node === null) {
         node = new Node(iter, item);
      }

      return node;
   }

   return {
      get executor() {
         return ensureNode();
      },
      get originator() {
         return ensureNode();
      },
      get node() {
         return node;
      }
   }
};


methodFor(Node, {
   fulfill() {
      doMounting(typ.mountingContextFor(this), warnOnError(this.iter.proc.bind(null, this.item)));
   },

   unmount() {
      toFulfill.enqueue(this);
      typ.dismantle(this, true);
   }
});
