-----
fs ::= $_.require('fs')
main ::= function () {
   let modules = $.insertModules();

   $.insertEntries(modules);
   $.insertImports(modules);

   $.validate(modules);
}
insertModules ::= function () {
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

   return modules;
}
insertEntries ::= function (modules) {
   let stmtInsertEntry = $_.db.prepare(`
      INSERT INTO entry(module_name, name, def, prev)
      VALUES (:module_name, :name, :def, :prev)
   `);

   for (let module of modules) {
      let prevName = null;

      for (let [name, src] of module.body) {
         let def = {
            type: 'native',
            src: src
         };

         stmtInsertEntry.run({
            module_name: module.name,
            name: name,
            def: JSON.stringify(def),
            prev: prevName
         });

         prevName = name;
      }
   }
}
insertImports ::= function (modules) {
   let stmtInsertImport = $_.db.prepare(`
      INSERT INTO import(recp_module_name, donor_module_name, name, alias)
      VALUES (:recp_module_name, :donor_module_name, :name, :alias)`
   );
   let stmtInsertStarImport = $_.db.prepare(`
      INSERT INTO star_import(recp_module_name, donor_module_name, alias)
      VALUES (:recp_module_name, :donor_module_name, :alias)`
   );

   for (let module of modules) {
      for (let {donor, asterisk, imports} of module.imports) {
         if (asterisk !== null) {
            stmtInsertStarImport.run({
               recp_module_name: module.name,
               donor_module_name: donor,
               alias: asterisk,
            });
         }

         for (let {entry, alias} of imports) {
            stmtInsertImport.run({
               recp_module_name: module.name,
               donor_module_name: donor,
               name: entry,
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
validate ::= function (modules) {
   // Check high-level constraints of the image (correctness)
   for (let module of modules) {
      $.validateModule(module);
   }
}
validateModule ::= function (module) {
   let entries = new Set(module.body.map(([name]) => name));

   for (let {donor, asterisk, imports} of module.imports) {
      if (asterisk !== null) {
         if (entries.has(asterisk)) {
            throw new Error(
               `Corrupted image: module "${module.name}" imports "${donor}" as ` +
               `"${asterisk}" which collides with another module member or import`
            );
         }
         entries.add(asterisk);
      }

      for (let {entry, alias} of imports) {
         let importedAs = alias || entry;
         if (entries.has(importedAs)) {
            console.log("Here!!", entry, alias, module);
            throw new Error(
               `Corrupted image: module "${module.name}" imports "${importedAs}" from ` +
               `"${donor}" which collides with another module member or import`
            );
         }
         entries.add(importedAs);
      }
   }
}
