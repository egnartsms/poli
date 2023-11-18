import * as util from '$/common/util.js';
import { methodFor } from '$/common/generic.js';
import { runningNode, affectedAttrs } from './node.js';

export { entity, AttrNotDefined };


const ENTITY = Symbol.for('poli.entity');


let entityToStore = new WeakMap;


function entity() {
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

      if (attr.definedBy !== null && attr.definedBy.isAncestorOf(runningNode))
         ;
      else {
         runningNode.useAttr(attr);
      }

      return attr.access();
   },

   set(store, prop, value, rcvr) {
      let attr = entityAttr(store, prop);

      if (attr.definedBy === null) {
         // TODO: works for max 1 nesting only
         (runningNode.parent ?? runningNode).defAttr(attr);
      }
      else if (attr.definedBy.isAncestorOf(runningNode))
         ;
      else {
         throw new AttrDuplicated(attr);
      }

      if (!affectedAttrs.has(attr)) {
         affectedAttrs.set(attr, attr.value);
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


methodFor(Attr, function access() {
   if (this.value === NON_DEFINED) {
      throw new AttrNotDefined(this);
   }

   return this.value;
});


/**
 * Make an attribute not defined again.
 * 
 * @return: a ghost info.
 */
methodFor(Attr, function ghostify() {
   let ghost = {
      usedBy: this.usedBy,
      value: this.value,
   };

   this.definedBy = null;
   this.usedBy = new Set;
   this.value = NON_DEFINED;

   return ghost;
});


methodFor(Attr, function undefine() {
   util.check(this.usedBy.size === 0);

   this.definedBy = null;
   this.value = NON_DEFINED;
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
