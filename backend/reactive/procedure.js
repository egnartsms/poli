import { methodFor } from '$/common/generic.js';
import { Queue } from '$/common/queue.js';
import * as util from '$/common/util.js';
import * as Nod from './node.js';
import { warnOnError } from './common.js';
import { excReactiveNormal } from './entity.js';
import { toFulfill, fulfillToFixpoint } from './fulfillment.js';
import { activeContext, doMounting } from './mount.js';


export {
   procedure,
   repeatable,
};


function procedure(name, proc) {
   toFulfill.enqueue(new Procedure(name, proc));
}


function repeatable(name, proc) {
   toFulfill.enqueue(new Repeatable(name, proc, activeContext().originator));
}


function Procedure(name, proc) {
   this.name = name;
   this.proc = proc;
   this.id = Nod.getNextId();
   this.exc = null;
   this.deps = new Set;
   this.effects = [];
}


methodFor(Procedure, {
   dependOn: Nod.dependOn,
   addEffect: Nod.addEffect,

   fulfill() {
      doMounting(Nod.mountingContextFor(this), () => {
         try {
            this.proc.call(this);
         }
         catch (exc) {
            this.exc = exc;
            
            if (!(excReactiveNormal in exc)) {
               console.warn("A procedure threw an unhandled exception: ", exc);
            }
         }
      });
   },

   /**
    * Called when a dependency invalidates. Should be re-computed.
    */
   unmount() {
      this.exc = null;
      toFulfill.enqueue(this);
      Nod.dismantle(this, true);
   }
});


methodFor(Procedure, function augment(body) {
   doMounting(Nod.mountingContextFor(this), warnOnError(body));
   fulfillToFixpoint();
});


function Repeatable(name, proc, parent) {
   this.parent = parent;
   this.name = name;
   this.proc = proc;
   this.exc = null;
   this.deps = new Set;
}


methodFor(Repeatable, {
   dependOn: Nod.dependOn,

   fulfill() {
      doMounting(
         {
            executor: this,
            originator: this.parent,
         },
         () => {
            try {
               this.proc.call(this.parent);
            }
            catch (exc) {
               this.exc = exc;

               if (!(excReactiveNormal in exc)) {
                  console.warn("A repeatable threw an unhandled exception: ", exc);
               }
            }
         }
      );
   },

   /**
    * Called when a dependency invalidates. Should be re-computed.
    */
   unmount() {
      this.exc = null;
      toFulfill.enqueue(this);
      Nod.clearDeps(this);
   }
});
