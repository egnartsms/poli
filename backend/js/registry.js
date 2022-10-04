import {Module} from './module';


export class Registry {
   constructor() {
      this.modules = new Map;
      this.nExisting = 0;
   }

   getModule(name, {create} = {create: false}) {
      let module = this.modules.get(name);

      if (module === undefined) {
         module = new Module(name);
         this.modules.set(name, module);

         if (create) {
            module.youExist();
            this.nExisting += 1;
         }
      }
      // The module may be already mentioned before but not yet created.
      else if (create && !module.exists.value) {
         module.youExist();
         this.nExisting += 1;
      }

      return module;
   }

   loadModuleData(mdata) {
      let module = this.getModule(mdata.name, {create: true});

      // Imports
      for (let {donor, imports} of mdata.imports) {
         let donorM = this.getModule(donor);

         for (let {name, alias} of imports) {
            if (name === null) {
               module.addAsterisk(donorM, alias);
            }
            else {
               module.addImport(donorM.getBinding(name), alias ?? name);
            }
         }
      }

      // Definitions
      for (let {target, definition} of mdata.body) {
         module.addEntry(target, definition);
      }
   }

   switchToRuntime() {
      for (let module of this.modules.values()) {
         module.switchToRuntime();
      }
   }

   moduleNsMap() {
      return new Map(
         Array.from(this.modules.values(), module => [module.name, module.ns])
      );
   }
}
