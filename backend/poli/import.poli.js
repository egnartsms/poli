bootstrap
   imports
persist
   deleteObject
rt-rec
   delmark
   rtget
   rtset
run
   assert
-----
addImport ::= function (imp) {
   $.assert(!$.imports.has(imp));

   let {recp, donor, alias, name} = imp;

   if (name === null) {
      recp.importedNames.add(alias);
      $.rtset(recp, alias, donor.rtobj);
   }
   else {
      recp.importedNames.add($.importedAs(imp));
      $.rtset(recp, $.importedAs(imp), $.rtget(donor, name));
   }

   $.imports.add(imp);
}
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
isEntryImportedByAnyone ::= function (module, name) {
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
entryImportsFromTo ::= function* (donor, recp) {
   for (let imp of $.imports) {
      if (imp.donor === donor && imp.recp === recp && imp.name !== null) {
         yield imp;
      }
   }
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

   recp.importedNames.delete($.importedAs(imp));
   $.imports.delete(imp);
   $.deleteObject(imp);
   
   $.rtset(recp, $.importedAs(imp), $.delmark);
}
