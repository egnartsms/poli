bootstrap
   imports
   validateImport
persist
   markAsDirty
rtrec
   delmark
   rtget
   rtset
-----
import ::= function (imp) {
   $.validateImport(imp);

   let {recp, donor, alias, name} = imp;

   $.markAsDirty(recp.importedNames);
   if (name === null) {
      recp.importedNames.add(alias);
      $.rtset(recp, alias, donor.rtobj);
   }
   else {
      recp.importedNames.add($.importedAs(imp));
      $.rtset(recp, $.importedAs(imp), $.rtget(donor, name));
   }

   $.markAsDirty($.imports);
   $.imports.add(imp);   
}
unimport ::= function (imp) {
   let {recp} = imp;

   $.markAsDirty(recp.importedNames);
   recp.importedNames.delete($.importedAs(imp));
   $.markAsDirty($.imports);
   $.imports.delete(imp);
   
   $.rtset(recp, $.importedAs(imp), $.delmark);
}
importedAs ::= function (imp) {
   return imp.alias || imp.name;
}
importsInto ::= function* (module) {
   for (let imp of $.imports) {
      if (imp.recp === module) {
         yield imp;
      }
   }
}
importsFrom ::= function* (module) {
   for (let imp of $.imports) {
      if (imp.donor === module) {
         yield imp;
      }
   }
}
importsFromTo ::= function* (donor, recp) {
   for (let imp of $.imports) {
      if (imp.donor === donor && imp.recp === recp) {
         yield imp;
      }
   }
}
entryImportsFromTo ::= function* (donor, recp) {
   for (let imp of $.importsFromTo(donor, recp)) {
      if (imp.name !== null) {
         yield imp;
      }
   }
}
importFromTo ::= function (donor, entry, recp) {
   for (let imp of $.importsFromTo(donor, recp)) {
      if (imp.name === entry) {
         return imp;
      }
   }
   return null;
}
importsOf ::= function* (module, entry) {
   for (let imp of $.importsFrom(module)) {
      if (imp.name === entry) {
         yield imp;
      }
   }
}
referrerImportsOf ::= function* (module, entry) {
   for (let imp of $.importsFrom(module)) {
      if (imp.name === entry || imp.name === null) {
         yield imp;
      }
   }
}
importFor ::= function (module, name) {
   for (let imp of $.imports) {
      if (imp.recp === module && $.importedAs(imp) === name) {
         return imp;
      }
   }
   return null;
}
moduleDepsOf ::= function (module) {
   let deps = new Set;
   for (let imp of $.importsInto(module)) {
      deps.add(imp.donor);
   }
   return deps;
}
moduleRevDepsOf ::= function (module) {
   let revdeps = new Set;
   for (let imp of $.importsFrom(module)) {
      revdeps.add(imp.recp);
   }
   return revdeps;
}
connectedModulesOf ::= function (module) {
   let modules = new Set;
   
   for (let m of $.moduleDepsOf(module)) {
      modules.add(m);
   }
   
   for (let m of $.moduleRevDepsOf(module)) {
      modules.add(m);
   }
   
   return modules;
}
referrersOf ::= function (module, entry) {
   let recps = new Set;

   for (let imp of $.referrerImportsOf(module, entry)) {
      recps.add(imp.recp);
   }

   return recps;
}
referrerImportsFromTo ::= function (donor, entry, recp) {
   return {
      eimp: $.importFromTo(donor, entry, recp),
      simp: $.importFromTo(donor, null, recp)
   };
}
