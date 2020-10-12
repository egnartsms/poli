bootstrap
   hasOwnProperty
common
   joindot
import
   importFor
   importedAs
   importsOf
   referenceImports
   starImportsOf
-----
assert ::= $_.require('assert').strict
isNameFree ::= function (module, name) {
   return !($.hasOwnProperty(module.defs, name) || module.importedNames.has(name));
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
isReferredTo ::= function (module, name, except=null) {
   let re = new RegExp(`(?<![a-z_$])\\$\\.${name.replace(/\./g, '\\.')}\\b`, 'i');

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
isEntryUsed ::= function (module, entry) {
   $.assert($.hasOwnProperty(module.defs, entry));

   if ($.isReferredTo(module, entry, entry)) {
      return true;
   }

   for (let recp of $.referrerModules(module, entry)) {
      let {eimp, simp} = $.referenceImports(module, entry, recp);
      if (eimp && $.isReferredTo(recp, $.importedAs(eimp))) {
         return true;
      }
      if (simp && $.isReferredTo(recp, $.joindot(simp.alias, entry))) {
         return true;
      }
   }

   return false;
}
resolveReference ::= function (module, star, name) {
   if (star !== null) {
      let {module: oModule, name: oName} = $.whereNameCame(module, star);
      if (!oModule) {
         return {found: false};
      }
      if (oName !== null) {
         return {
            found: true,
            module: oModule,
            name: oName,
            reduced: true
         };
      }
      if (!$.hasOwnProperty(oModule.defs, name)) {
         return {found: false};
      }
      return {
         found: true,
         module: oModule,
         name: name
      };
   }
   else {
      let {module: oModule, name: oName} = $.whereNameCame(module, name);
      if (!oModule) {
         return {found: false};
      }

      return {
         found: true,
         module: oModule,
         name: oName
      };
   }
}
extractRefs ::= function (module, entry) {
   let names = new Set();
   let re = /(?<![a-z_$])\$\.([0-9a-z_]+(?:\.[0-9a-z_]+)?)\b/gi;

   for (let [, ref] of module.defs[entry].src.matchAll(re)) {
      names.add(ref);
   }

   return names;
}
