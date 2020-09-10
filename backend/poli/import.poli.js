bootstrap
   imports
persist
   deleteObject
rt-rec
   delmark
   rtset
-----
importedAs ::= function (imp) {
   return imp.alias || imp.name;
}
importsOf ::= function* (module, name) {
   for (let imp of $.imports) {
      if (imp.donor === module && imp.name === name) {
         yield imp;
      }
   }
}
starImportsOf ::= function* (module) {
   for (let imp of $.imports) {
      if (imp.donor === module && imp.name === null) {
         yield imp;
      }
   }
}
isNameUsedForImport ::= function (module, name) {
   let {done} = $.importsOf(module, name).next();
   return !done;
}
importFor ::= function (module, name) {
   for (let imp of $.imports) {
      if (imp.recp === module && $.importedAs(imp) === name) {
         return imp;
      }
   }
   return null;
}
importFromTo ::= function (donor, name, recp) {
   for (let imp of $.imports) {
      if (imp.donor === donor && imp.recp === recp && imp.name === name) {
         return imp;
      }
   }
   return null;
}
starImportFromTo ::= function (donor, recp) {
   return $.importFromTo(donor, null, recp);
}
recipientsOf ::= function (module, name) {
   let recps = new Set;
   for (let imp of $.importsOf(module, name)) {
      recps.add(imp.recp);
   }
   return Array.from(recps);
}
referabilityImports ::= function (donor, entry, recp) {
   return {
      eimp: $.importFromTo(donor, entry, recp),
      simp: $.starImportFromTo(donor, recp)
   };
}
deleteImport ::= function (imp) {
   let {recp} = imp;

   $.rtset(recp, $.importedAs(imp), $.delmark);
   recp.importedNames.delete($.importedAs(imp));
   $.imports.delete(imp);
   $.deleteObject(imp);
}
