bootstrap
   imports
   validateImport
persist
   deleteObject
   setAdd
   setDelete
rt-rec
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
   $.deleteObject(imp);
   
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
recipientsOf ::= function (module, entry) {
   let recps = new Set;
   for (let imp of $.importsOf(module, entry)) {
      recps.add(imp.recp);
   }
   return Array.from(recps);
}
connectedModulesOf ::= function (module) {
   let modules = new Set;
   
   for (let imp of $.importsFrom(module)) {
      modules.add(imp.recp);
   }
   
   for (let imp of $.importsInto(module)) {
      modules.add(imp.donor);
   }
   
   return modules;
}
referenceImports ::= function (donor, entry, recp) {
   return {
      eimp: $.importFromTo(donor, entry, recp),
      simp: $.importFromTo(donor, null, recp)
   };
}
