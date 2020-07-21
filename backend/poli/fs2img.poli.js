-----
fs ::= $_.require('fs')
main ::= function () {
   let stmtInsertModule = $_.db.prepare(
      `INSERT INTO module(name) VALUES (:module_name)`
   );
   let modules = [];
   
   for (let moduleFile of $.fs.readdirSync($_.SRC_FOLDER)) {
      let moduleName = $.moduleNameByFile(moduleFile);
      if (moduleName === null) {
         console.warn(`Encountered file "${moduleFile}" which is not Poli module. Ignored`);
         continue;
      }

      stmtInsertModule.run({module_name: moduleName});

      let contents = $.fs.readFileSync(`./${$_.SRC_FOLDER}/${moduleFile}`, 'utf8');
      let {imports, body} = $.parseModule(contents);

      modules.push({
         name: moduleName,
         imports,
         body
      });
   }

   // Insert module bodies
   let stmtInsertEntry = $_.db.prepare(
      `INSERT INTO entry(module_id, name, def, prev_id) VALUES (
         (SELECT id FROM module WHERE name = :module_name),
         :name,
         :def,
         (
            SELECT e.id
            FROM entry e INNER JOIN module m ON e.module_id = m.id
            WHERE m.name = :module_name AND e.name = :prev_name
         )
      )`
   );

   let prevName = null;

   for (let module of modules) {
      let prevId = null;

      for (let [name, src] of module.body) {
         let def = {
            type: 'native',
            src: src
         };

         stmtInsertEntry.run({
            module_name: module.name,
            name: name,
            def: JSON.stringify(def),
            prev_name: prevName
         });

         prevName = name;
      }
   }

   // Insert imports
   let stmtInsertImport = $_.db.prepare(
      `INSERT INTO import(recp_module_id, donor_entry_id, alias) VALUES (
         (SELECT id FROM module WHERE name = :recp_module),
         (SELECT e.id
          FROM entry e INNER JOIN module m on e.module_id = m.id
          WHERE e.name = :entry_name AND m.name = :donor_module),
         :alias
      )`
   );
   let stmtInsertStarImport = $_.db.prepare(
      `INSERT INTO star_import(recp_module_id, donor_module_id, alias) VALUES (
         (SELECT id FROM module WHERE name = :recp_module),
         (SELECT id FROM module WHERE name = :donor_module),
         :alias
      )`
   );

   for (let recpModule of modules) {
      for (let {donor, asterisk, imports} of recpModule.imports) {
         if (asterisk) {
            stmtInsertStarImport.run({
               recp_module: recpModule.name,
               donor_module: donor,
               alias: asterisk,
            });
         }

         for (let {entry, alias} of imports) {
            stmtInsertImport.run({
               recp_module: recpModule.name,
               donor_module: donor,
               entry_name: entry,
               alias: alias,
            });
         }
      }
   }
}
parseModule ::= function (str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = $.parseImports(rawImports);
   let body = $_.parseBody(rawBody);

   return {imports, body};
}
parseImports ::= function (str) {
   let res = [];

   for (let [[,donor], rawImports] of $_.matchAllHeaderBodyPairs(str, /^(\S.*?)\s*\n/gm)) {
      let imports = Array.from(
         rawImports.matchAll(/^\s+(?<entry>.*?)(?:\s+(as)\s+(?<alias>.+?))?\s*$/gm)
      );

      if (imports.length === 0) {
         // This should not normally happen but not an error
         continue;
      }

      let asterisk = null;

      if (imports[0].groups.entry === '*') {
         asterisk = imports[0].groups.alias;
         imports.splice(0, 1);
      }

      res.push({
         donor,
         asterisk,
         imports: Array.from(imports, imp => ({
            entry: imp.groups.entry,
            alias: imp.groups.alias || null,
         }))
      });
   }

   return res;
}
moduleNameByFile ::= function (moduleFile) {
   let mtch = /^(?<module_name>.+?)\.poli\.js$/.exec(moduleFile);
   if (!mtch) {
      return null;
   }

   return mtch.groups.module_name;
}
