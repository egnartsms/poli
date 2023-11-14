import {methodFor} from '$/common/generic.js';
import {check} from '$/common/util.js';

export {
   procedure,
   runToFixpoint,
   runningNode,
   nodeSetAttrs
};


function procedure(name, body) {
   let node = new Node(body);
   unmountedNodes.add(node);
}


let unmountedNodes = new Set;
let attrGhosts = new Map;

let runningNode = null;
let nodeSetAttrs = null;


function Node(proc) {
   this.proc = proc;
   this.exc = null;
   this.defAttrs = new Set;
   this.useAttrs = new Set;
   this.undo = [];
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

   let setAttrs = new Map;

   runningNode = this;
   nodeSetAttrs = setAttrs;

   try {
      this.proc();
      this.exc = null;
   }
   catch (exc) {
      this.exc = exc;
   }
   finally {
      runningNode = null;
      nodeSetAttrs = null;
   }

   for (let [attr, value] of setAttrs) {
      if (value !== attr.value) {
         unmountNodeSet(attr.usedBy);
      }

      let ghost = attrGhosts.get(attr);

      if (ghost !== undefined) {
         if (value === ghost.value) {
            // Revive the ghost
            attr.usedBy = ghost.usedBy;
         }
         else {
            // Kill the ghost
            unmountNodeSet(ghost.usedBy);
         }

         attrGhosts.delete(attr);
      }

      attr.value = value;
   }

   unmountedNodes.delete(this);
});


methodFor(Node, function augment(body) {
   check(runningNode === null);

   let setAttrs = new Map;

   runningNode = this;
   nodeSetAttrs = setAttrs;

   try {
      return body();
   }
   finally {
      runningNode = null;
      nodeSetAttrs = null;

      for (let [attr, value] of setAttrs) {
         if (value !== attr.value) {
            unmountNodeSet(attr.usedBy);
         }

         attr.value = value;
      }

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

   this.unuseAllAttrs();
   this.undefAllAttrs();

   if (this.undo.length > 0) {
      this.undo.reverse();

      for (let undo of this.undo) {
         console.log("Calling undo:", undo);
         undo();
      }

      this.undo.length = 0;
   }

   unmountedNodes.add(this);
});


methodFor(Node, function unuseAllAttrs() {
   for (let attr of this.useAttrs) {
      attr.usedBy.delete(this);
   }

   this.useAttrs.clear();
});


methodFor(Node, function undefAllAttrs() {
   for (let attr of this.defAttrs) {
      attrGhosts.set(attr, attr.ghostify());
   }

   this.defAttrs.clear();
});
