bootstrap
   imports
   modules
-----
fs ::= $_.require('fs')
main ::= function () {
   for (let module of $.modules) {
      $.dumpModule(module);
   }
}
dumpModule ::= function (module) {
   function compare(x, y) {
      return (x < y) ? -1 : (x > y) ? 1 : 0;
   }

   let moduleStream = $.fs.createWriteStream(`${$_.SRC_FOLDER}/${module.name}.poli.js`, {
      mode: '664'
   });
   $.writingToStream(moduleStream, function* () {
      const ind = '   ';
      let imports = [];
      for (let imp of $.imports) {
         if (imp.recp === module) {
            imports.push(imp);
         }
      }
      imports.sort((i1, i2) => {
         let z = compare(i1.donor.name, i2.donor.name);
         if (z !== 0) {
            return z;
         }

         if (i1.name === null) {
            return -1;
         }
         if (i2.name === null) {
            return 1;
         }

         return compare(i1.name, i2.name);
      });

      // Imports
      let curDonorName = null;

      for (let {recp, donor, name, alias} of imports) {
         if (donor.name !== curDonorName) {
            curDonorName = donor.name;
            yield curDonorName;
            yield '\n';
         }

         yield ind;
         yield name === null ? '*' : name;
         if (alias) {
            yield ` as ${alias}`;
         }
         yield '\n';
      }

      yield '-----\n';

      // Body
      for (let [name, {src}] of Object.entries(module.defs)) {
         yield name;
         yield ' ::= ';
         yield src;
         yield '\n';
      }
   });
}
writingToStream ::= function (stream, generatorFunc) {
   for (let piece of generatorFunc()) {
      console.log(piece);
      if (piece === null) {
         throw new Error("Null to stream!");
      }
      stream.write(piece);
   }

   stream.end();
}
