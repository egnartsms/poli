import {rigidCell, computableCell, getter} from './engine.js';


export class Binding {
   constructor(module, name) {
      this.module = module;
      this.name = name;
      this.inputs = rigidCell([]);
      this.state = computableCell(() => computeState(this));
      this.value = computableCell(() => computeValue(this));
   }

   defineAsTarget(def) {
      this.inputs.mutate(arr => arr.push({def}));
   }

   defineAsImport(donorBinding) {
      // TODO: continue here
      this.inputs.mutate(arr => arr.push({donorBinding}));
   }

   defineAsAsterisk(donorModule) {
      this.inputs.mutate(arr => arr.push({donorModule}));
   }

   runtimeValueDescriptor() {
      let state = this.state.value;

      if (state.isOk && Object.hasOwn(state, 'runtimeValue')) {
         return {
            writable: false,
            value: state.runtimeValue
         }
      }
      else {
         // TODO: we cannot have it read-only because our dynamic module members wouldn't
         // work. When we have full generalized 'target-definition' schema, the
         // read-onliness should be explicitly managed. By default, we should have
         // writable: false, and only where needed should it be made writable.
         let desc = Object.getOwnPropertyDescriptor(this.value, 'value');
         if (Object.hasOwn(desc, 'writable')) {
            desc.writable = true;
         }
         return desc;
      }
   }
}


function computeState(binding) {
   if (binding.inputs().length === 0) {
      return {
         isOk: false,
         reason: 'undefined'
      };
   }

   if (binding.inputs().length > 1) {
      return {
         isOk: false,
         reason: 'duplicate'
      };
   }

   let [input] = binding.inputs();

   if (Object.hasOwn(input, 'def')) {
      let {def} = input;

      return {
         isOk: true,
         source: def
      }
   }
   else if (Object.hasOwn(input, 'donorBinding')) {
      let {donorBinding} = input;

      if (donorBinding.state().isOk) {
         return {
            isOk: true,
            source: donorBinding.value
         }
      }
      else {
         return {
            isOk: false,
            reason: 'import-of-broken',
         }
      }
   }
   else if (Object.hasOwn(input, 'donorModule')) {
      let {donorModule} = input;

      if (donorModule.exists()) {
         return {
            isOk: true,
            source: () => donorModule.nsProxy,
            runtimeValue: donorModule.ns
         }
      }
      else {
         return {
            isOk: false,
            reason: 'import-of-broken'
         }
      }
   }
   else
      throw new Error(`Logic error`);
}


function computeValue(binding) {
   if (binding.state().isOk) {
      let {source} = binding.state();

      return source();
   }
   else {
      let {reason} = binding.state();

      if (reason === 'undefined') {
         return getter(() => {
            throw new Error(`Referenced undefined binding '$.${binding.name}'`);
         });
      }
      else if (reason === 'duplicate') {
         return getter(() => {
            throw new Error(`Referenced duplicated binding '$.${binding.name}'`);
         });
      }
      else if (reason === 'import-of-broken') {
         return getter(() => {
            throw new Error(`Referenced broken or non-existing import '$.${binding.name}'`);
         })
      }
      else
         throw new Error(`Logic error`);
   }
}
