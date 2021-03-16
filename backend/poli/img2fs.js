bootstrap
   modules
xs-printer
   dumpsNext
-----
ind ::= '   '
main ::= function () {
   for (let moduleName in $.modules) {
      $.dumpModule($.modules[moduleName]);
   }
}
dumpModule ::= function (module) {
   // This needs refactoring, as Poli runtime can now run in Browser
   let moduleStream = $.fs.createWriteStream(
      `${$_.SRC_FOLDER}/${module.name}.${module.lang}`, {
         mode: '664'
      }
   );

   $.writingToStream(moduleStream, function* () {
      yield* $.dumpModuleImportSection(module);
      yield '-----\n';

      // Body
      for (let entry of module.entries) {
         yield entry;
         yield ' ::=';
         yield* $.dumpDef(module.lang, module.defs[entry]);
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
dumpDef ::= function* (lang, def) {
   if (lang === 'js') {
      yield ' ';
      yield def;
   }
   else if (lang === 'xs') {
      yield* $.dumpsNext(def.syntax, 0);
   }
   else {
      throw new Error;
   }
}
dumpModuleImportSection ::= function* (module) {
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
sortedImportsInto ::= function (recp) {
   let imports = Array.from(recp.imports);
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
