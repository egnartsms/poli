import {Binding} from './binding';
import {computableCell, restart, rigidCell} from './engine';


export class Module {
   constructor(name) {
      this.name = name;
      this.exist = false;
      this.bindings = new Map;
      this.setters$ = [];
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
      let factory, set$;

      try {
         [factory, set$] = Function(factorySource(source))();
      }
      catch (e) {
         console.error(source);
         targetBinding.defineAsTarget(rigidCell.exc(e));
         return;
      }

      set$(new Proxy(this.ns, {
         get: (target, prop, receiver) => this.getBinding(prop).value()
      }));

      let cell = computableCell(factory);
      let targetBinding = this.getBinding(target);

      targetBinding.defineAsTarget(cell);

      this.setters$.push(set$);
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
         Object.defineProperty(this.ns, binding.name, {
            configurable: true,
            enumerable: true,
            ...binding.value.val.descriptor()
         })
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
