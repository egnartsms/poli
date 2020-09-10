bootstrap
   hasOwnProperty
import
   importFor
   importsOf
   starImportsOf
-----
isNameFree ::= function (module, name) {
   return !($.hasOwnProperty(module.defs, name) || module.importedNames.has(name));
}
isNameReferredTo ::= function (module, name) {
   let re = new RegExp(`\\$\\.${name}\\b`);

   for (let {src} of Object.values(module.defs)) {
      if (re.test(src)) {
         return true;
      }
   }

   return false;
}
whereNameCame ::= function (module, name) {
   if ($.hasOwnProperty(module.defs, name)) {
      return {module, name};
   }

   if (module.importedNames.has(name)) {
      let imp = $.importFor(module, name);
      return {module: imp.donor, name: imp.name};
   }

   return {};
}
extractRefs ::= function (module, entry) {
   let names = new Set();
   let re = /\$\.([0-9a-zA-Z_]+(?:\.[0-9a-zA-Z_]+)?)/g;

   for (let [, ref] of module.defs[entry].src.matchAll(re)) {
      names.add(ref);
   }

   return names;
}
referrerModules ::= function (module, entry) {
   let referrers = new Set;

   for (let imp of $.importsOf(module, entry)) {
      referrers.add(imp.recp);
   }

   for (let imp of $.starImportsOf(module)) {
      referrers.add(imp.recp);
   }

   return referrers;
}
anyDefRefersTo ::= function (module, ref, except=null) {
   let re = new RegExp(`(?<![a-zA-Z_$])\\$\\.${ref}\\b`);

   for (let entry of module.entries) {
      if (except && entry === except) {
         continue;
      }

      if (re.test(module.defs[entry].src)) {
         return true;
      }
   }

   return false;
}
