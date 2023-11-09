import {methodFor} from '$/common/generic.js';

export {
   procedure,
   entity,
   runToFixpoint
};


function procedure(name, body) {
   let node = new Node(body);
   nodesToMount.add(node);
}


let nodesToMount = new Set;
let runningNode = null;


function Node(body) {
   this.body = body;
   this.defAttrs = new Set;
}


function Attr(entity, name) {
   this.entity = entity;
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


let entityToTarget = new WeakMap;


function entity() {
   let target = {__proto__: null};
   let entity = new Proxy(target, entityProxyHandler);

   entityToTarget.set(entity, target);

   return entity;
}


const entityProxyHandler = {
   get(target, prop, rcvr) {
      let attr = entityAttr(rcvr, target, prop);

      if (runningNode !== attr.definedBy) {
         attr.usedBy.add(runningNode);
      }

      return attr.access();
   },

   set(target, prop, value, rcvr) {
      let attr = entityAttr(rcvr, target, prop);

      if (attr.definedBy === null) {
         attr.definedBy = runningNode;
         runningNode.defAttrs.add(attr);
      }
      else if (attr.definedBy !== runningNode) {
         throw new AttrDuplicated(attr);
      }

      attr.value = value;

      return true;
   }
};


function entityAttr(entity, target, name) {
   if (target[name] === undefined) {
      target[name] = new Attr(entity, name);
   }

   return target[name];
}


function runToFixpoint() {
   for (let node of nodesToMount) {
      runningNode = node;

      try {
         node.body();
      }
      finally {
         runningNode = null;
      }
   }

   nodesToMount.clear();
}
