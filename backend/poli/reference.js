bootstrap
   assert
   hasOwnProperty
common
   joindot
import
   importFor
   importsOf
   referrerImportsFromTo
   referrersOf
-----
isNameFree ::= function (module, name) {
   return !(module.name2entry.has(name) || module.imported.has(name));
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
   // TODO: implement for XS. For now, we don't know how to check for identifier
   // bindings, so we assume that nothing is referred to.
   if (module.lang === 'xs') {
      return false;
   }

   let re = new RegExp(`(?<![\\w$])\\$\\.${name.replace(/\./g, '\\.')}\\b`);

   for (let entry of module.entries) {
      if (entry === except) {
         continue;
      }

      if (re.test(entry.def)) {
         return true;
      }
   }

   return false;
}
referrerModules1 ::= function (module, entry) {
   let referrers = new Set;

   for (let imp of $.importsOf(module, entry)) {
      referrers.add(imp.recp);
   }

   for (let imp of $.importsOf(module, null)) {
      referrers.add(imp.recp);
   }

   return referrers;
}
isEntryUsed ::= function (module, entry) {
   $.assert($.hasOwnProperty(module.defs, entry));

   if ($.isReferredTo(module, entry, entry)) {
      return true;
   }

   for (let recp of $.referrersOf(module, entry)) {
      let {eimp, simp} = $.referrerImportsFromTo(module, entry, recp);
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
   let re = /(?<![\w$])\$\.(\w+(?:\.\w+)?)\b/gi;

   for (let [, ref] of module.defs[entry].matchAll(re)) {
      names.add(ref);
   }

   return names;
}
