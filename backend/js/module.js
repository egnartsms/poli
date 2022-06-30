import {Binding} from './binding';
import {computableCell, restart} from './engine';


export class Module {
   constructor(name) {
      this.name = name;
      this.exist = false;
      this.bindings = new Map;
      this.defs = [];
      this.ns = Object.create(null);
   }

   youExist() {
      this.exist = true;
   }

   getBinding(name) {
      let binding = this.bindings.get(name);

      if (binding === undefined) {
         binding = new Binding(this, name);
         this.bindings.set(name, binding);
      }

      return binding;
   }

   addEntry(target, source) {
      let targetBinding = this.getBinding(target);
      let defCell = computableCell(() => this.compileDefinition(source));

      targetBinding.defineAsTarget(defCell);
      this.defs.push(defCell);
   }

   addImport(donorBinding, importUnder) {
      let targetBinding = this.getBinding(importUnder);

      targetBinding.defineAsImport(donorBinding);
   }

   addAsterisk(donor, alias) {
      let targetBinding = this.getBinding(alias);

      targetBinding.defineAsAsterisk(donor);
   }

   compileDefinition(source) {
      let factory = Function('$ns, $proxy', factoryFuncSource(source));

      // this is to avoid re-creating 'factory' when we need to re-evaluate the
      // definition
      return restart(() => factory.call(null, this.ns, new Proxy(this.ns, {
         get: (target, prop, receiver) => this.getBinding(prop).value()
      })));
   }

   populateNamespace() {
      for (let binding of this.bindings.values()) {
         Object.defineProperty(this.ns, binding.name, {
            configurable: true,
            enumerable: true,
            ...binding.value.val.descriptor()
         })
      }
   }
}


// params are: $ns, $proxy
const factoryFuncSource = (source) => `
   "use strict";
   let $ = $proxy;
   let $res = (${source});
   $ = $ns;
   return $res;
`;
