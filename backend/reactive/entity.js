import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { activeContext, registerMountingMiddleware } from './mount.js';
import { toFulfill, registerPostFixpointCallback } from './fulfillment.js';
import { unmountNodeSet } from './node.js';

export { makeEntity, excReactiveNormal };


let entityToStore = new WeakMap;


const symEntity = Symbol.for('poli.entity');
const symCreatorId = Symbol.for('poli.creatorId');


function makeEntity(setAttrs) {
   let context = activeContext();

   let store = {
      __proto__: null,
      [symEntity]: null,
      [symCreatorId]: context?.originator.id ?? 0,
   };

   let entity = new Proxy(store, entityProxyHandler);

   store[symEntity] = entity;
   entityToStore.set(entity, store);

   Object.assign(entity, setAttrs);

   return entity;
}


const entityProxyHandler = {
   get(store, prop, rcvr) {
      let attr = entityAttr(store, prop);
      let {executor, originator} = activeContext();

      if (attr.definedByNodeId !== originator.id) {
         executor.dependOn(attr);
      }

      if (attr.definedByNodeId === 0) {
         throw new AttrNotDefined(attr);
      }

      return attr.value;
   },

   set(store, prop, value, rcvr) {
      let attr = entityAttr(store, prop);
      let {originator, setAttrs} = activeContext();

      if (attr.definedByNodeId === 0) {
         attr.definedByNodeId = originator.id;

         // If the same node that created this entity is setting an attribute on it, don't record it
         // as effect. So the attribute won't be unset when the node is unmounted.
         if (store[symCreatorId] !== originator.id) {
            originator.addEffect(attr);
         }
      }
      else if (attr.definedByNodeId === originator.id)
         ;
      else {
         throw new AttrDuplicated(attr);
      }

      if (!setAttrs.has(attr)) {
         setAttrs.set(attr, attr.value);
      }

      attr.value = value;

      return true;
   },
};


function entityAttr(store, name) {
   if (!Object.hasOwn(store, name)) {
      store[name] = new Attr(store, name);
   }

   return store[name];
}


function Attr(store, name) {
   this.store = store;
   this.name = name;
   this.definedByNodeId = 0;
   this.value = NON_DEFINED;
   this.usedBy = new Set;
   this.prevValue = NON_DEFINED;
   this.prevUsedBy = null;
}


methodFor(Attr, {
   useBy(node) {
      this.usedBy.add(node);
   },

   unuseBy(node) {
      this.usedBy.delete(node);
      potentialGarbage.add(this);
   },

   undo(reversibly) {
      util.check(this.definedByNodeId !== 0);

      this.definedByNodeId = 0;

      if (reversibly && this.prevUsedBy === null) {
         this.prevValue = this.value;
         this.prevUsedBy = this.usedBy;
         this.value = NON_DEFINED;
         this.usedBy = new Set;

         toFulfill.enqueue(this);
      }
      else {
         this.value = NON_DEFINED;
         unmountNodeSet(this.usedBy);
      }

      potentialGarbage.add(this);
   },

   fulfill() {
      util.check(this.prevUsedBy !== null);

      if (this.value === this.prevValue) {
         // Same value restored => retain all the previous usages
         util.addAll(this.prevUsedBy, this.usedBy);

         this.usedBy = this.prevUsedBy;
      }
      else {
         // Value changed => unmount previous usages
         unmountNodeSet(this.prevUsedBy);
      }

      this.prevUsedBy = null;
      this.prevValue = NON_DEFINED;
   }
});


const NON_DEFINED = Symbol('NON_DEFINED');


registerMountingMiddleware((context, next) => {
   context.setAttrs = new Map;

   next();

   for (let [attr, oldValue] of context.setAttrs) {
      if (oldValue !== attr.value) {
         unmountNodeSet(attr.usedBy);
      }
   }
});


let potentialGarbage = new Set;


registerPostFixpointCallback(() => {
   for (let attr of potentialGarbage) {
      if (isAbandoned(attr)) {
         console.log(`Unlinking attr:`, attr.name);
         delete attr.store[attr.name];
      }
   }

   potentialGarbage.clear();
});


function isAbandoned(attr) {
   return (attr.usedBy.size === 0) && (attr.definedByNodeId === 0);
}


class AttrError extends Error {
   constructor(message, attr) {
      super(message);
      this.attr = attr;
   }
}


class AttrNotDefined extends AttrError {
   constructor(attr) {
      super(`Attribute not defined: '${attr.name}'`, attr);
   }
}

const excReactiveNormal = Symbol.for('poli.exc-reactive-normal');

AttrNotDefined.prototype[excReactiveNormal] = true;


class AttrDuplicated extends AttrError {
   constructor(attr) {
      super(`Attribute already defined elsewhere: '${attr.name}'`, attr);
   }
}


class AttrFixed extends AttrError {
   constructor(name) {
      super(`Attribute is fixed but attempted to set: '${name}'`, null);
      this.name = name;
   }
}
