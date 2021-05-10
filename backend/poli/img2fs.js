trie
   * as: trie
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
