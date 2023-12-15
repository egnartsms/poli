import { methodFor } from '$/common/generic.js';
import { Queue } from '$/common/queue.js';
import * as util from '$/common/util.js';
import { warnOnError } from './common.js';
import { excReactiveNormal } from './entity.js';
import { toFulfill, fulfillToFixpoint } from './fulfillment.js';
import { activeContext, doMounting } from './mount.js';
import * as typ from './typical-node.js';


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
   this.exc = null;
   this.deps = new Set;
   this.effects = [];
}


methodFor(Procedure, typ.dependOn);
methodFor(Procedure, typ.addEffect);


methodFor(Procedure, {
   fulfill() {
      doMounting(typ.mountingContextFor(this), () => {
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
      typ.dismantle(this, true);
   }

});


methodFor(Procedure, function augment(body) {
   doMounting(typ.mountingContextFor(this), warnOnError(body));
   fulfillToFixpoint();
});


function Repeatable(name, proc, parent) {
   this.parent = parent;
   this.name = name;
   this.proc = proc;
   this.exc = null;
   this.deps = new Set;
}


methodFor(Repeatable, typ.dependOn);


methodFor(Repeatable, function mountingContext() {
   return {
      executor: this,
      originator: this.parent,
   };
});


methodFor(Repeatable, {
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
      typ.clearDeps(this);
   }
});
