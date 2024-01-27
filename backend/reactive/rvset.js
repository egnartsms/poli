import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { activeContext } from './mount.js';
import { toFulfill } from './fulfillment.js';
import { Iteration } from './iteration.js';
import { Version } from './version.js';

export { RvSet };


/**
 * Reactive set. Does not support reactive checking for membership.
 * 
 * 'add()', 'remove()' do not record themselves as effects;
 * 'eAddUnique()' does.
 */
class RvSet {
   items;
   nrefs = 0;
   ver = null;
   iterations = new Set;

   constructor(iterable) {
      this.items = new Set(iterable);
   }

   forEach(proc) {
      let iteration = new Iteration(this, proc);

      this.iterations.add(iteration);
      this.nrefs += 1;
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
         this.ver = this.ver.next = new Version;
      }

      return this.ver;
   }

   [Symbol.iterator]() {
      return this.items[Symbol.iterator]();
   }

   add(item) {
      if (this.items.has(item)) {
         return false;
      }

      this.items.add(item);

      if (this.ver !== null) {
         this.ver.add(item);
      }

      toFulfill.enqueueAll(this.iterations);
      this.iterations.clear();

      return true;
   }

   remove(item) {
      if (!this.items.has(item)) {
         return false;
      }

      this.items.delete(item);

      if (this.ver !== null) {
         this.ver.remove(item);
      }

      toFulfill.enqueueAll(this.iterations);
      this.iterations.clear();

      return true;
   }

   eAddUnique(item) {
      util.check(!this.items.has(item), "Item not unique");

      this.add(item);

      activeContext().originator.addEffect({
         undo() {
            util.check(this.items.has(item), "Item not present for undoing => corruption");

            this.remove(item);
         }
      });
   }
}
