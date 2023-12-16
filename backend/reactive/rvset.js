import * as util from '$/common/util.js';
import { activeContext } from './mount.js';
import { toFulfill } from './fulfillment.js';
import { Iteration } from './iteration.js';
import { Version } from './version.js';

export { RvSet };


/**
 * Reactive set that only supports population by a single node. Does not support reactive checking
 * for membership.
 */
class RvSet {
   originator;
   items;
   nrefs = 0;
   ver = null;
   iterations = new Set;

   constructor(iterable) {
      let context = activeContext();

      util.check(context != null, `An RvSet created outside a reactive procedure`);

      this.originator = context.originator;
      this.items = new Set(iterable);
   }

   forEach(proc) {
      let iteration = new Iteration(this, proc);

      this.iterations.add(iteration);
      this.nrefs += 1;

      toFulfill.enqueue(iteration);
   }

   unrefBy(iter) {
      this.nrefs -= 1;
      this.iterations.delete(iter);

      if (this.nrefs === 0) {
         this.ver = null;
      }
   }

   iterationFulfilled(iter) {
      this.iterations.add(iter);
   }

   currentVersion() {
      if (this.ver === null) {
         this.ver = new Version;
      }
      else if (this.ver.isClean())
         ;
      else {
         this.ver.next = new Version;
         this.ver = this.ver.next;
      }

      return this.ver;
   }

   [Symbol.iterator]() {
      return this.items[Symbol.iterator]();
   }

   add(item) {
      util.check(
         activeContext().originator === this.originator,
         `RvSet modified not by its original creator`
      );

      this.items.add(item);
      
      if (this.ver !== null) {
         this.ver.add(item);
      }

      toFulfill.enqueueAll(this.iterations);
      this.iterations.clear();
   }

   remove(item) {
      util.check(
         activeContext().originator === this.originator,
         `RvSet modified not by its original creator`
      );

      this.items.delete(item);      

      if (this.ver !== null) {
         this.ver.remove(item);
      }

      toFulfill.enqueueAll(this.iterations);
      this.iterations.clear();
   }
}
