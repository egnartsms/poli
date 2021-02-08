bootstrap
   imports
   validateImport
persist
   setAdd
   setDelete
rtrec
   delmark
   rtget
   rtset
-----
import ::= function (imp) {
   $.validateImport(imp);

   let {recp, donor, alias, name} = imp;

   if (name === null) {
      $.setAdd(recp.importedNames, alias);
      $.rtset(recp, alias, donor.rtobj);
   }
   else {
      $.setAdd(recp.importedNames, $.importedAs(imp));
      $.rtset(recp, $.importedAs(imp), $.rtget(donor, name));
   }

   $.setAdd($.imports, imp);
}
unimport ::= function (imp) {
   let {recp} = imp;

   $.setDelete(recp.importedNames, $.importedAs(imp));
   $.setDelete($.imports, imp);
   
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
recipientsOf ::= function (module, entry) {
   let recps = new Set;
   for (let imp of $.importsOf(module, entry)) {
      recps.add(imp.recp);
   }
   return Array.from(recps);
}
referenceImports ::= function (donor, entry, recp) {
   return {
      eimp: $.importFromTo(donor, entry, recp),
      simp: $.importFromTo(donor, null, recp)
   };
}
