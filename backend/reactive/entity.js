import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { mergeSetsIntoBigger } from '$/common/data.js';
import { registerMountingMiddleware, activeContext } from './mount.js';
import { toFulfill, registerPostFixpointCallback } from './fulfillment.js';
import { unmountNodeSet } from './typical-node.js';

export { makeEntity, excReactiveNormal };


let entityToStore = new WeakMap;


const ENTITY = Symbol.for('poli.entity');


function makeEntity(fixedProps) {
   let store = {
      __proto__: null,
      [ENTITY]: null
   };

   if (fixedProps) {
      for (let [prop, value] of Object.entries(fixedProps)) {
         store[prop] = {isFixed: true, value: value};
      }
   }

   let entity = new Proxy(store, entityProxyHandler);

   store[ENTITY] = entity;
   entityToStore.set(entity, store);

   return entity;
}


const entityProxyHandler = {
   get(store, prop, rcvr) {
      let attr = entityAttr(store, prop);

      if (attr.isFixed) {
         return attr.value;
      }

      let {executor, originator} = activeContext();

      if (attr.definedBy === null) {
         executor.dependOn(attr);
         throw new AttrNotDefined(attr);
      }

      if (attr.definedBy === originator)
         ;
      else {
         executor.dependOn(attr);
      }

      return attr.setting.value;
   },

   set(store, prop, value, rcvr) {
      let attr = entityAttr(store, prop);

      if (attr.isFixed) {
         throw new AttrFixed(prop);
      }

      let {originator, setAttrs} = activeContext();

      if (attr.definedBy === null) {
         attr.definedBy = originator;
         originator.addEffect(attr);
      }
      else if (attr.definedBy === originator)
         ;
      else {
         throw new AttrDuplicated(attr);
      }

      if (!setAttrs.has(attr)) {
         setAttrs.set(attr, attr.setting.value);
      }

      attr.setting.value = value;

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
   this.definedBy = null;
   this.setting = freshAttrSetting(null);
}


Attr.prototype.isFixed = false;


methodFor(Attr, {
   useBy(node) {
      this.setting.usedBy.add(node);
   },

   unuseBy(node) {
      this.setting.usedBy.delete(node);
      potentialGarbage.add(this);
   },

   undo(reversibly) {
      util.check(this.definedBy !== null);

      this.definedBy = null;

      if (reversibly) {
         this.setting = freshAttrSetting(this.setting);
         toFulfill.enqueue(this);
      }
      else {
         this.setting.value = NON_DEFINED;
         unmountNodeSet(this.setting.usedBy);
      }

      potentialGarbage.add(this);
   },

   fulfill() {
      let usedBy = this.setting.usedBy;
      let valueNow = this.setting.value;

      // In 99.9% cases there will be only 1 iteration of this loop
      for (let setg = this.setting.prev; setg !== null; setg = setg.prev) {
         if (setg.value === valueNow) {
            usedBy = mergeSetsIntoBigger(setg.usedBy, usedBy);
         }
         else {
            unmountNodeSet(setg.usedBy);
         }
      }

      this.setting.usedBy = usedBy;
      this.setting.prev = null;
   }
});


function freshAttrSetting(prev) {
   return {
      value: NON_DEFINED,
      usedBy: new Set,
      prev: prev
   };
}


const NON_DEFINED = Symbol('NON_DEFINED');


registerMountingMiddleware((context, next) => {
   context.setAttrs = new Map;

   next();

   for (let [attr, oldValue] of context.setAttrs) {
      if (oldValue !== attr.setting.value) {
         unmountNodeSet(attr.setting.usedBy);
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
   return (attr.setting.usedBy.size === 0) && (attr.definedBy === null);
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


class AttrNotOwned extends AttrError {
   constructor(attr) {
      super(
         `Attribute is not defined by the current node (or not defined at all): '${attr.name}'`,
         attr
      );
   }
}


class AttrFixed extends AttrError {
   constructor(name) {
      super(`Attribute is fixed but attempted to set: '${name}'`, null);
      this.name = name;
   }
}


class AttrNotExists extends AttrError {
   constructor(name) {
      super(`Attribute does not yet exist: '${name}'`, null);
      this.name = name;
   }
}
