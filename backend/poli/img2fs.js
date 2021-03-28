bootstrap
   modules
common
   setDefault
xs-codegen
   cgenFunc
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
   let moduleStream = $_.fs.createWriteStream(
      `poli/${module.name}.${module.lang}`, {
         mode: '664'
      }
   );

   $.writingToStream(moduleStream, function* () {
      yield* $.dumpModuleImportSection(module);
      yield '-----\n';

      // Body
      for (let entry of module.entries) {
         yield entry.name;
         yield ' ::=';
         yield* $.dumpDef(entry);
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
dumpDef ::= function* (entry) {
   if (entry.module.lang === 'js') {
      yield ' ';
      yield entry.def;
   }
   else if (entry.module.lang === 'xs') {
      yield* $.dumpsNext(entry.def, 0);
   }
   else {
      throw new Error;
   }
}
dumpModuleImportSection ::= function* (module) {
   let spec = $.importSectionSpec(module);
   
   for (let [donorName, imports] of spec) {
      yield donorName;
      yield '\n';

      for (let [name, alias] of imports) {
         yield $.ind;
         yield name === null ? '*' : name;
         if (alias) {
            yield ` as: ${alias}`;
         }
         yield '\n';
      }
   }
}
importSectionSpec ::= function (recp) {
   let donors = new Map;
   
   for (let [as, entry] of recp.imported) {
      $.setDefault(donors, entry.module, () => []).push([entry, as]);
   }
   
   for (let asNames of donors.values()) {
      asNames.sort(([e1], [e2]) => $.compareEntries(e1, e2));
   }

   let orderedDonors = [...donors.keys()];
   orderedDonors.sort((m1, m2) => $.compareStrings(m1.name, m2.name));
   
   return Array.from(orderedDonors, donor => [
      donor.name,
      Array.from(donors.get(donor), ([entry, as]) => [
         entry.name,
         entry.name === as ? null : as
      ])
   ]);
}
compareEntries ::= function (e1, e2) {
   if (e1.name === null) {
      return -1;
   }
   if (e2.name === null) {
      return 1;
   }

   return $.compareStrings(e1.name, e2.name);
}
compareStrings ::= function (s1, s2) {
   return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
}
