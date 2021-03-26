bootstrap
   validateImport
transact
   DpropDel
   DpropGet
   DpropSet
   setAdd
   setRemove
   mapSet
   mapDelete
   mapRemove
-----
import ::= function (entry, recp, as) {
   $.validateImport(entry, recp, as);
   
   $.mapSet(recp.imported, as, entry);
   $.mapSet($.exportedFor(entry), recp, as);
   
   $.DpropSet(recp.rtobj, as, $.entryRtVal(entry));
}
exportedFor ::= function (entry) {
   let exported = entry.module.exported.get(entry);

   if (exported === undefined) {
      exported = new Map;
      $.mapSet(entry.module.exported, entry, exported);
   }

   return exported;
}
entryRtVal ::= function (entry) {
   if (entry.name === null)
      return entry.module.rtobj;
   else
      return $.DpropGet(entry.module.rtobj, entry.name);
}
unimport ::= function (entry, recp) {
   let exported = $.exportedFor(entry);  
   let as = exported.get(recp);

   $.mapRemove(exported, recp);
   $.mapRemove(recp.imported, as);
   $.DpropDel(recp.rtobj, as);
}
importsFromTo ::= function* (donor, recp) {
   if (donor.exports.size < recp.imports.size) {
      for (let imp of donor.exports) {
         if (imp.recp === recp) {
            yield imp;
         }
      }
   }
   else {
      for (let imp of recp.imports) {
         if (imp.donor === donor) {
            yield imp;
         }
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
   for (let imp of module.exports) {
      if (imp.name === entry) {
         yield imp;
      }
   }
}
referrerImportsOf ::= function* (module, entry) {
   for (let imp of module.exports) {
      if (imp.name === entry || imp.name === null) {
         yield imp;
      }
   }
}
importFor ::= function (module, name) {
   for (let imp of module.imports) {
      if (imp.recp === module && $.importedAs(imp) === name) {
         return imp;
      }
   }
   return null;
}
moduleDepsOf ::= function (module) {
   let deps = new Set;
   for (let imp of module.imports) {
      deps.add(imp.donor);
   }
   return deps;
}
moduleRevDepsOf ::= function (module) {
   let revdeps = new Set;
   for (let imp of module.exports) {
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
