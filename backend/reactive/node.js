import { methodFor } from '$/common/generic.js';
import * as util from '$/common/util.js';
import { Queue } from '$/common/queue.js';
// import { AttrNotDefined } from './entity.js';

export {
   procedure,
   repeatable,
   runToFixpoint,
   toRemount,
   unmountNodeSet,
   mountingContext,
   registerMountingMiddleware
};


function procedure(name, proc) {
   let node = new Procedure(proc);

   toRemount.enqueue(node);
}


function Procedure(proc) {
   this.proc = proc;
   this.exc = null;
   this.effects = [];
   this.deps = new Set;
}


Procedure.prototype.parent = null;


function repeatable(name, proc) {
   util.check(mountingContext !== null);

   let node = new Repeatable(proc, mountingContext.originator);

   toRemount.enqueue(node);
}


function Repeatable(proc, parent) {
   this.parent = parent;
   this.proc = proc;
   this.exc = null;
   this.deps = new Set;
}


let toRemount = new Queue;


function runToFixpoint() {
   while (!toRemount.isEmpty) {
      let item = toRemount.dequeue();

      item.remount();
   }
}


methodFor([Procedure, Repeatable], function dependOn(dep) {
   this.deps.add(dep);
   dep.usedBy.add(this);
});


methodFor(Procedure, function addEffect(effect) {
   this.effects.push(effect);
});

// methodFor(Procedure)

// methodFor(Procedure, function isSameOriginator(node) {
//    return this === node;
// });


// methodFor(Repeatable, function isSameOriginator(node) {
//    return this.parent === node;
// });


let topMountingMiddleware = null;


function registerMountingMiddleware(wrapper) {
   topMountingMiddleware = {
      wrapper: wrapper,
      next: topMountingMiddleware
   }
}


function callThruMountingMiddlewares(context, body) {
   util.check(mountingContext === null);

   function call(middleware) {
      if (middleware === null) {
         mountingContext = context;
         body();
         mountingContext = null;
      }
      else {
         middleware.wrapper.call(null, context, () => call(middleware.next));
      }
   }

   call(topMountingMiddleware);
}


let mountingContext = null;


methodFor(Procedure, function mountingContext() {
   return {
      originator: this,
      executor: this
   }
});


methodFor(Repeatable, function mountingContext() {
   return {
      originator: this.parent,
      executor: this
   }
});


methodFor([Procedure, Repeatable], function remount() {
   callThruMountingMiddlewares(this.mountingContext(), () => {
      try {
         this.proc.call(mountingContext.originator);
         this.exc = null;
      }
      catch (exc) {
         this.exc = exc;
         // if (!(exc instanceof AttrNotDefined)) {
         //    console.warn("Node exception:", exc);
         // }
      }
   });
});


methodFor(Procedure, function augment(body) {
   callThruMountingMiddlewares(this.mountingContext(), () => {
      try {
         body();
      }
      catch (e) {
         console.warn(`Error in node augmentation:`, e);
      }
   });

   runToFixpoint();
});


methodFor(Procedure, function unmount() {
   this.exc = null;
   disconnectFromDeps(this);

   toRemount.enqueue(this);

   while (this.effects.length > 0) {
      this.effects.pop().undo();
   }
});


methodFor(Repeatable, function unmount() {
   this.exc = null;
   disconnectFromDeps(this);
   toRemount.enqueue(this);
});


function disconnectFromDeps(node) {
   for (let dep of node.deps) {
      dep.usedBy.delete(node);
   }

   node.deps.clear();
}


function unmountNodeSet(nodeSet) {
   if (nodeSet.size === 0) {
      return;
   }

   for (let node of nodeSet) {
      node.unmount();
   }

   nodeSet.clear();
}


// /**
//  * A nested Node can be regarded as an effect.
//  */
// methodFor(Node, function undo() {
   
// });


// methodFor(Node, function kill() {
//    if (toRemount.has(this)) {
//       // The node may have already been unmounted. In this case, it is already stripped, so just
//       // forget about it. If some of its defined attrs have been ghostified, it's not a problem:
//       // they will be handled normally.
//       toRemount.delete(this);
//       return;
//    }

//    strip(this, true);

//    if (this.parent !== null) {
//       this.parent.children.delete(this);
//    }
// });


// function strip(node, isKilling) {
//    node.unuseAllAttrs();

//    if (isKilling) {
//       node.undefineAllAttrs();
//    }
//    else {
//       node.ghostifyAllDefinedAttrs();
//    }

//    if (node.undo.length > 0) {
//       node.undo.reverse();

//       for (let undo of node.undo) {
//          console.log("Calling undo:", undo);
//          undo();
//       }

//       node.undo.length = 0;
//    }

//    if (node.children.size > 0) {
//       for (let child of node.children) {
//          child.kill();
//       }

//       node.children.clear();
//    }
// }


// methodFor(Node, function unuseAllAttrs() {
//    for (let attr of this.useAttrs) {
//       attr.usedBy.delete(this);
//    }

//    this.useAttrs.clear();
// });


// methodFor(Node, function undefineAllAttrs() {
//    for (let attr of this.defAttrs) {
//       unmountNodeSet(attr.usedBy);
//       attr.undefine();
//    }

//    this.defAttrs.clear();
// });


// methodFor(Node, function ghostifyAllDefinedAttrs() {
//    for (let attr of this.defAttrs) {
//       attrGhosts.set(attr, attr.ghostify());
//    }

//    this.defAttrs.clear();
// });
