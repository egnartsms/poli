import {Binding} from './binding';
import {computableCell, rigidCell} from './engine';
import {publicDescriptor} from './common';


export class Module {
   constructor(name) {
      this.name = name;
      this.exists = rigidCell(false);
      this.bindings = new Map;
      this.setters$ = [];
      this.ns = {__proto__: null};
      this.nsProxy = new Proxy(this.ns, {
         get: (target, prop, receiver) => this.getBinding(prop).value()
      });
   }

   youExist() {
      this.exists.set(true);
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
      let factory, set$;

      try {
         [factory, set$] = Function(factorySource(source))();
      }
      catch (e) {
         console.error(source);
         targetBinding.defineAsTarget(rigidCell.exc(e));
         return;
      }

      set$(this.nsProxy);
      this.setters$.push(set$);

      targetBinding.defineAsTarget(computableCell(factory));
   }

   addImport(donorBinding, importUnder) {
      let targetBinding = this.getBinding(importUnder);

      targetBinding.defineAsImport(donorBinding);
   }

   addAsterisk(donor, alias) {
      let targetBinding = this.getBinding(alias);

      targetBinding.defineAsAsterisk(donor);
   }

   switchToRuntime() {
      for (let binding of this.bindings.values()) {
         Object.defineProperty(
            this.ns, binding.name, publicDescriptor(binding.runtimeValueDescriptor())
         );
      }

      for (let set$ of this.setters$) {
         set$(this.ns);
      }
   }
}


// params are: $ns, $proxy
const factorySource = (source) => `
   "use strict";
   let $;

   return [
      () => (${source}),
      (new$) => { $ = new$ }
   ]
`;
