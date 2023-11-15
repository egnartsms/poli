import { methodFor } from '$/common/generic.js';
import { check } from '$/common/util.js';
import { AttrNotDefined } from './entity.js';

export {
   procedure,
   runToFixpoint,
   runningNode,
   affectedAttrs
};


function procedure(name, proc) {
   new Node(runningNode, proc);
}


let unmountedNodes = new Set;
let attrGhosts = new Map;

let runningNode = null;
let affectedAttrs = new Map;


function Node(parent, proc) {
   this.parent = parent;
   this.proc = proc;
   this.exc = null;
   this.defAttrs = new Set;
   this.useAttrs = new Set;
   this.undo = [];
   this.children = new Set;

   if (parent !== null) {
      parent.children.add(this);
   }

   unmountedNodes.add(this);
}


methodFor(Node, function useAttr(attr) {
   this.useAttrs.add(attr);
   attr.usedBy.add(this);
});


/**
 * 'attr' is assumed not to be defined by any other node.
 */
methodFor(Node, function defAttr(attr) {
   this.defAttrs.add(attr);
   attr.definedBy = this;
});


methodFor(Node, function isAncestorOf(node) {
   while (node !== null && node !== this) {
      node = node.parent;
   }

   return node === this;
});


function runToFixpoint() {
   while (unmountedNodes.size > 0 || attrGhosts.size > 0) {
      while (unmountedNodes.size > 0) {
         let [node] = unmountedNodes;

         node.mount();
      }

      // All the ghosts that are still here were abandoned => kill them and unmount all nodes that
      // depend on them.
      for (let [attr, ghost] of attrGhosts) {
         unmountNodeSet(ghost.usedBy);
      }

      attrGhosts.clear();
   }
}


methodFor(Node, function mount() {
   check(runningNode === null);

   runningNode = this;

   try {
      this.proc();
      this.exc = null;
   }
   catch (exc) {
      this.exc = exc;
      if (!(exc instanceof AttrNotDefined)) {
         console.warn("Node exception:", exc);
      }
   }

   runningNode = null;

   for (let [attr, oldValue] of affectedAttrs) {
      if (oldValue !== attr.value) {
         // if we are here then the node either:
         //   - set an attribute that it used to define before and which is currently a ghost.
         //     Someone may have referred to this attr while it was a ghost, so need to unmount all
         //     such nodes.
         //   - set an attribute defined by its parent to a different value.
         unmountNodeSet(attr.usedBy);
      }

      let ghost = attrGhosts.get(attr);

      if (ghost !== undefined) {
         if (attr.value === ghost.value) {
            // Revive the ghost
            attr.usedBy = ghost.usedBy;
         }
         else {
            // Kill the ghost
            unmountNodeSet(ghost.usedBy);
         }

         attrGhosts.delete(attr);
      }
   }

   affectedAttrs.clear();
   unmountedNodes.delete(this);
});


methodFor(Node, function augment(body) {
   check(runningNode === null);

   runningNode = this;

   try {
      return body();
   }
   finally {
      runningNode = null;

      for (let [attr, oldValue] of affectedAttrs) {
         if (oldValue !== attr.value) {
            unmountNodeSet(attr.usedBy);
         }
      }

      affectedAttrs.clear();

      runToFixpoint();
   }
});


function unmountNodeSet(nodeSet) {
   if (nodeSet.size === 0) {
      return;
   }

   for (let node of nodeSet) {
      node.unmount();
   }

   nodeSet.clear();
}


methodFor(Node, function unmount() {
   check(!unmountedNodes.has(this));

   strip(this, false);
   unmountedNodes.add(this);
});


methodFor(Node, function kill() {
   if (unmountedNodes.has(this)) {
      // The node may have already been unmounted. In this case, it is already stripped, so just
      // forget about it. If some of its defined attrs have been ghostified, it's not a problem:
      // they will be handled normally.
      unmountedNodes.delete(this);
      return;
   }

   strip(this, true);

   if (this.parent !== null) {
      this.parent.children.delete(this);
   }
});


function strip(node, isKilling) {
   node.unuseAllAttrs();

   if (isKilling) {
      node.undefineAllAttrs();
   }
   else {
      node.ghostifyAllDefinedAttrs();
   }

   if (node.undo.length > 0) {
      node.undo.reverse();

      for (let undo of node.undo) {
         console.log("Calling undo:", undo);
         undo();
      }

      node.undo.length = 0;
   }

   if (node.children.size > 0) {
      for (let child of node.children) {
         child.kill();
      }

      node.children.clear();
   }
}


methodFor(Node, function unuseAllAttrs() {
   for (let attr of this.useAttrs) {
      attr.usedBy.delete(this);
   }

   this.useAttrs.clear();
});


methodFor(Node, function undefineAllAttrs() {
   for (let attr of this.defAttrs) {
      unmountNodeSet(attr.usedBy);
      attr.undefine();
   }

   this.defAttrs.clear();
});


methodFor(Node, function ghostifyAllDefinedAttrs() {
   for (let attr of this.defAttrs) {
      attrGhosts.set(attr, attr.ghostify());
   }

   this.defAttrs.clear();
});
