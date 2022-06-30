import {rigidCell, computableCell, getter} from './engine';


export class Binding {
   constructor(module, name) {
      this.module = module;
      this.name = name;
      this.inputs = rigidCell([]);
      this.state = computableCell(this.computeState.bind(this));
      this.value = computableCell(this.computeValue.bind(this));
   }

   defineAsTarget(def) {
      this.inputs.mutate(arr => arr.push({def}));
   }

   defineAsImport(donorBinding) {
      this.inputs.mutate(arr => arr.push({donorBinding}));
   }

   defineAsAsterisk(donorModule) {
      this.inputs.mutate(arr => arr.push({donorModule}));
   }

   computeState() {
      if (this.inputs().length === 0) {
         return {
            isDefined: false,
            reason: 'undefined'
         };
      }

      if (this.inputs().length > 1) {
         return {
            isDefined: false,
            reason: 'duplicate'
         };
      }

      let [input] = this.inputs();

      if (input.hasOwnProperty('def')) {
         let {def} = input;

         return {
            isDefined: true,
            source: def
         }
      }
      else if (input.hasOwnProperty('donorBinding')) {
         let {donorBinding} = input;

         if (donorBinding.state().isDefined) {
            return {
               isDefined: true,
               source: donorBinding.value
            }
         }
         else {
            return {
               isDefined: false,
               reason: 'import-of-broken',
            }
         }
      }
      else if (input.hasOwnProperty('donorModule')) {
         let {donorModule} = input;

         return {
            isDefined: true,
            source: () => donorModule.ns
         }
      }
      else
         throw new Error(`Logic error`);
   }

   computeValue() {
      if (this.state().isDefined) {
         let {source} = this.state();

         return source();
      }
      else {
         let {reason} = this.state();

         if (reason === 'undefined') {
            return getter(() => {
               throw new Error(`Referenced undefined binding '$.${this.name}'`);
            });
         }
         else if (reason === 'duplicate') {
            return getter(() => {
               throw new Error(`Referenced duplicated binding '$.${this.name}'`);
            });
         }
         else if (reason === 'import-of-broken') {
            return getter(() => {
               throw new Error(`Referenced broken import '$.${this.name}'`);
            })
         }
         else
            throw new Error(`Logic error`);
      }
   }
}
