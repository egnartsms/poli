import {methodFor} from '$/common/generic.js';
import {check} from '$/common/util.js';

export {
   procedure,
   runToFixpoint,
   runningNode,
   nodeSetAttrs,
   callAsMounting
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


methodFor(Node, function defAttr(attr) {
   this.defAttrs.add(attr);
   attr.definedBy = this;
});


methodFor(Node, function unuseAllAttrs() {
   for (let attr of this.useAttrs) {
      attr.usedBy.delete(this);
   }

   this.useAttrs.clear();
});


function runToFixpoint() {
   while (unmountedNodes.size > 0 || attrGhosts.size > 0) {
      while (unmountedNodes.size > 0) {
         let [node] = unmountedNodes;

         mountNode(node);
      }

      // All the ghosts that are still here were abandoned => kill them
      for (let [attr, ghost] of attrGhosts) {
         unmountNodeSet(ghost.usedBy);
      }

      attrGhosts.clear();
   }
}


function callAsMounting(node, body) {
   check(runningNode === null);

   let setAttrs = new Map;

   runningNode = node;
   nodeSetAttrs = setAttrs;

   let retVal;

   try {
      retVal = body();
      node.exc = null;
   }
   catch (e) {
      node.exc = e;
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

   return retVal;
}


function mountNode(node) {
   callAsMounting(node, node.proc.bind(node));
   unmountedNodes.delete(node);
}


function unmountNodeSet(nodeSet) {
   if (nodeSet.size === 0) {
      return;
   }

   for (let node of nodeSet) {
      unmountNode(node);
   }

   nodeSet.clear();
}


function unmountNode(node) {
   check(!unmountedNodes.has(node));

   node.unuseAllAttrs();

   for (let attr of node.defAttrs) {
      attrGhosts.set(attr, attr.ghostify());
   }
   node.defAttrs.clear();

   node.undo.reverse();
   for (let undo of node.undo) {
      console.log("Calling undo:", undo);
      undo();
   }
   node.undo.length = 0;

   unmountedNodes.add(node);
}
