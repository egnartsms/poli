img2fs
   dumpModuleImportSection
import
   importsOf
-----
assert ::= function (cond) {
   if (!cond) {
      throw new Error(`Assert failed`);
   }
}
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
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
lessThan ::= function (a, b) {
   return a < b;
}
equal ::= function equal(a, b) {
   return a === b;
}
itorFinal ::= function (itor) {
   let finalItem = undefined;

   for (let item of itor) {
      finalItem = item;
   }

   return finalItem;
}
findIndex ::= function (itbl, pred) {
   let i = -1;

   for (let x of itbl) {
      i += 1;
      if (pred(x)) {
         return i;
      }
   }

   return -1;
}
indexOf ::= function (itbl, item) {
   let i = -1;

   for (let x of itbl) {
      i += 1;
      if (x === item) {
         return i;
      }
   }

   return -1;
}
arraysEqual ::= function arraysEqual (A, B) {
   if (A.length !== B.length) {
      return false;
   }

   for (let i = 0; i < A.length; i += 1) {
      if (A[i] !== B[i]) {
         return false;
      }
   }
   return true;
}
map ::= function* (fn, itbl) {
   for (let x of itbl) {
      yield fn(x);
   }
}
newObj ::= function (proto, props) {
   return Object.assign(Object.create(proto), props);
}