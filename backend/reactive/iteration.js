import { methodFor } from '$/common/generic.js';
import * as Nd from './node.js';
import { doMounting } from './mount.js';
import { warnOnError } from './common.js';

export { Iteration };


function Iteration(coll, proc) {
   this.coll = coll;
   this.proc = proc;
   this.itemToNode = new Map;
   this.ver = coll.currentVersion();

   for (let item of coll) {
      this.runFor(item);
   }
}


methodFor(Iteration, {
   undo(reversibly) {
      for (let node of this.itemToNode.values()) {
         Nd.dismantle(node, reversibly);
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
            Nd.dismantle(node, false);
         }
      }

      for (let item of this.ver.added) {
         this.runFor(item);
      }

      this.ver = this.coll.currentVersion();
      this.coll.iterationFulfilled(this);
   }
});


methodFor(Iteration, function runFor(item) {
   let context = lazyMountingContext(this, item);

   doMounting(context, warnOnError(this.proc.bind(null, item)));

   if (context.node !== null) {
      this.itemToNode.set(item, context.node);
   }
});


/**
 * Iteration node
 */
function Node(iter, item) {
   this.iter = iter;
   this.item = item;
   this.id = Nd.getNextId();
   this.deps = new Set;
   this.effects = [];
}


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
   dependOn: Nd.dependOn,
   addEffect: Nd.addEffect,

   fulfill() {
      doMounting(Nd.mountingContextFor(this), warnOnError(this.iter.proc.bind(null, this.item)));
   },

   unmount() {
      toFulfill.enqueue(this);
      Nd.dismantle(this, true);
   }
});
