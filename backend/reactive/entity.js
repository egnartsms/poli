import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { registerMountingMiddleware, unmountNodeSet, mountingContext, toRemount } from './node.js';

export { makeEntity, AttrNotDefined };


let entityToStore = new WeakMap;


const ENTITY = Symbol.for('poli.entity');


function makeEntity() {
   let store = {
      __proto__: null,
      [ENTITY]: null
   };
   let entity = new Proxy(store, entityProxyHandler);

   store[ENTITY] = entity;
   entityToStore.set(entity, store);

   return entity;
}


const entityProxyHandler = {
   get(store, prop, rcvr) {
      let attr = entityAttr(store, prop);
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
   }
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
   this.usedBy = new Set;
   this.value = NON_DEFINED;
}


const NON_DEFINED = Symbol('NON_DEFINED');


// methodFor(Attr, function access() {
//    if (this.value === NON_DEFINED) {
//       throw new AttrNotDefined(this);
//    }

//    return this.value;
// });


methodFor(Attr, function undo() {
   toRemount.enqueue(new AttrCheck(this));

   this.definedBy = null;
   this.usedBy = new Set;
   this.value = NON_DEFINED;
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


class AttrNotDefined extends Error {
   constructor(attr) {
      super(`Attribute not defined: '${attr.name}'`);
      this.attr = attr;
   }
}


class AttrDuplicated extends Error {
   constructor(attr) {
      super(`Attribute defined in multiple nodes: '${attr.name}'`);
      this.attr = attr;
   }
}


registerMountingMiddleware((context, next) => {
   context.setAttrs = new Map;

   next();

   for (let [attr, oldValue] of context.setAttrs) {
      if (oldValue !== attr.value) {
         unmountNodeSet(attr.usedBy);
      }
   }
});
