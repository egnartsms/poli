bootstrap
   modules
img2fs
   genModuleImportSection
import
   importedAs
   importsOf
rt-rec
   rtget
   rtset
-----
moduleByName ::= function (name) {
   let module = $.modules[name];
   if (!module) {
      throw new Error(`Unknown module name: ${name}`);
   }
   return module;
}
joindot ::= function (starName, entryName) {
   return starName + '.' + entryName;
}
dumpImportSection ::= function (module) {
   let pieces = [];
   for (let piece of $.genModuleImportSection(module)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
dumpImportSections ::= function (modules) {
   let result = {};
   for (let module of modules) {
      result[module.name] = $.dumpImportSection(module);
   }
   return result;
}
propagateValueToRecipients ::= function (module, name) {
   let val = $.rtget(module, name);
   for (let imp of $.importsOf(module, name)) {
      $.rtset(imp.recp, $.importedAs(imp), val);
   }
}
moduleNames ::= function (module) {
   return [...module.entries, ...module.importedNames];
}
isSeqNonEmpty ::= function (seq) {
   let {done} = seq[Symbol.iterator]().next();
   return !done;
}
