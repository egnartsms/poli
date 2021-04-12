bootstrap
   assert
   importedAs
   modules
   rtget
   rtset
img2fs
   dumpModuleImportSection
import
   importsOf
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
   for (let piece of $.dumpModuleImportSection(module)) {
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
extendArray ::= function (A, X) {
   let i = A.length;
   let j = 0;
   let len = X.length;
   
   A.length += len;
   
   while (j < len) {
      A[i] = X[j];
      i += 1;
      j += 1;
   }
}
yreExec ::= function (re, offset, str) {
   $.assert(re.sticky);
   re.lastIndex = offset;
   return re.exec(str);
}
yreTest ::= function (re, offset, str) {
   $.assert(re.sticky);
   re.lastIndex = offset;
   return re.test(str);
}
parameterize ::= function (tobind, callback) {
   $.assert(tobind.length % 2 === 0);
   
   let oldvals = new Array(tobind.length / 2);
   let i = 0, k = 0;
   
   while (i < tobind.length) {
      oldvals[k] = tobind[i].val;
      tobind[i].val = tobind[i + 1];
      
      i += 2;
      k += 1;
   }
   
   try {
      return callback();
   }
   finally {
      i = 0; k = 0;

      while (i < tobind.length) {
         tobind[i].val = oldvals[k];
         
         i += 2;
         k += 1;
      }
   }
}
compareValues ::= function (a, b) {
   return a < b ? -1 : a > b ? 1 : 0;
}