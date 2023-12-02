import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { registerMountingMiddleware, addPostFixpointCallback, unmountNodeSet, mountingContext, toRemount } from './node.js';

export { makeEntity, AttrNotDefined };


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

      let {executor, originator} = mountingContext;

      if (attr.definedBy === null) {
         executor.dependOn(attr);
         throw new AttrNotDefined(attr);
      }

      if (attr.definedBy === originator)
         ;
      else {
         executor.dependOn(attr);
      }

      return attr.value;
   },

   set(store, prop, value, rcvr) {
      let attr = entityAttr(store, prop);
      
      if (attr.isFixed) {
         throw new AttrFixed(prop);
      }

      let {originator, setAttrs} = mountingContext;

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
         setAttrs.set(attr, attr.value);
      }

      attr.value = value;

      return true;
   },
};


registerMountingMiddleware((context, next) => {
   context.setAttrs = new Map;

   next();

   for (let [attr, oldValue] of context.setAttrs) {
      if (oldValue !== attr.value) {
         unmountNodeSet(attr.usedBy);
      }
   }
});


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
   this.usedBy = new Set;
   this.value = NON_DEFINED;
}


const NON_DEFINED = Symbol('NON_DEFINED');


Attr.prototype.isFixed = false;


// methodFor(Attr, function access() {
//    if (this.value === NON_DEFINED) {
//       throw new AttrNotDefined(this);
//    }

//    return this.value;
// });


methodFor(Attr, function useBy(node) {
   this.usedBy.add(node);
});


methodFor(Attr, function unuseBy(node) {
   this.usedBy.delete(node);

   if (isAbandoned(this)) {
      potentialGarbage.add(this);
   }
});


function isAbandoned(attr) {
   return (attr.usedBy.size === 0) && (attr.definedBy === null);
}


methodFor(Attr, function undo() {
   toRemount.enqueue(new AttrCheck(this));

   this.definedBy = null;
   this.usedBy = new Set;
   this.value = NON_DEFINED;

   if (this.usedBy.size === 0) {
      potentialGarbage.add(this);
   }
});


function AttrCheck(attr) {
   this.attr = attr;
   this.usedBy = attr.usedBy;
   this.oldValue = attr.value;
}


methodFor(AttrCheck, function remount() {
   if (this.attr.value === this.oldValue) {
      unmountNodeSet(this.attr.usedBy);
      this.attr.usedBy = this.usedBy;
   }
   else {
      unmountNodeSet(this.usedBy);
   }
});


let potentialGarbage = new Set;


addPostFixpointCallback(() => {
   for (let attr of potentialGarbage) {
      if (isAbandoned(attr)) {
         unlink(attr);
      }
   }

   potentialGarbage.clear();
});


function unlink(attr) {
   console.log(`Unlinking attr:`, attr.name);
   delete attr.store[attr.name];
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
