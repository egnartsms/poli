bootstrap
   imports
   modules
-----
fs ::= $_.require('fs')
ind ::= '   '
main ::= function () {
   for (let moduleName in $.modules) {
      $.flushModule($.modules[moduleName]);
   }
}
flushModule ::= function (module) {
   let moduleStream = $.fs.createWriteStream(
      `${$_.SRC_FOLDER}/${module.name}.js`, {
         mode: '664'
      }
   );

   $.writingToStream(moduleStream, function* () {
      yield* $.genModuleImportSection(module);
      yield '-----\n';

      // Body
      for (let entry of module.entries) {
         yield entry;
         yield ' ::= ';
         yield module.defs[entry].src;
         yield '\n';
      }
   });
}
writingToStream ::= function (stream, generatorFunc) {
   for (let piece of generatorFunc()) {
      stream.write(piece);
   }

   stream.end();
}
sortedImportsInto ::= function (recp) {
   let imports = [];
   for (let imp of $.imports) {
      if (imp.recp === recp) {
         imports.push(imp);
      }
   }

   imports.sort($.compareImports);

   return imports;
}
compareImports ::= function (i1, i2) {
   if (i1.donor.name !== i2.donor.name) {
      return (i1.donor.name < i2.donor.name) ? -1 : 1;
   }

   if (i1.name === null) {
      return -1;
   }
   if (i2.name === null) {
      return 1;
   }

   return (i1.name < i2.name) ? -1 : i1.name > i2.name ? 1 : 0;
}
genModuleImportSection ::= function* (module) {
   let imports = $.sortedImportsInto(module);
   let curDonorName = null;

   for (let {recp, donor, name, alias} of imports) {
      if (donor.name !== curDonorName) {
         curDonorName = donor.name;
         yield curDonorName;
         yield '\n';
      }

      yield $.ind;
      yield name === null ? '*' : name;
      if (alias) {
         yield ` as: ${alias}`;
      }
      yield '\n';
   }
}
