import {methodFor} from '$/common/generic.js';
import {runningNode, nodeSetAttrs} from './node.js';

export {entity};


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

      if (runningNode === attr.definedBy) {
         if (nodeSetAttrs.has(attr)) {
            return nodeSetAttrs.get(attr);
         }
      }
      else {
         runningNode.useAttr(attr);
      }

      return attr.access();
   },

   set(store, prop, value, rcvr) {
      let attr = entityAttr(store, prop);

      if (attr.definedBy === null) {
         runningNode.defAttr(attr);
      }
      else if (attr.definedBy === runningNode)
         ;
      else {
         throw new AttrDuplicated(attr);
      }

      nodeSetAttrs.set(attr, value);

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
   this.value = NOT_DEFINED;
}


const NOT_DEFINED = Symbol('NOT_DEFINED');


methodFor(Attr, function access() {
   if (this.value === NOT_DEFINED) {
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
   this.value = NOT_DEFINED;

   return ghost;
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
