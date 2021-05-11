loader
   G
trie
   * as: trie
-----
assert ::= function (cond) {
   if (!cond) {
      throw new Error(`Assert failed`);
   }
}
obj2id ::= new WeakMap()
nextObjId ::= 1
objId ::= function (obj) {
   let id = $.obj2id.get(obj);
   if (id === undefined) {
      id = $.nextObjId++;
      $.obj2id.set(obj, id);
   }
   return id;
}
hasOwnProperty ::= function (obj, prop) {
   return Object.prototype.hasOwnProperty.call(obj, prop);
}
patchObj ::= function (obj, patch) {
   return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj, patch);
}
joindot ::= function (starName, entryName) {
   return starName + '.' + entryName;
}
ind ::= '   '
dumpImportSection ::= function (mid, G) {
   let pieces = [];
   for (let piece of $.dumpModuleImportSection(mid, G)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
dumpModuleImportSection ::= function* (mid, G) {
   let imports = $.sortedImportsInto(mid, G);
   let curDonorId = null;

   for (let {recpid, donorid, entry, alias} of imports) {
      if (donorid !== curDonorId) {
         curDonorId = donorid;
         yield $.trie.at(G.modules.byId, curDonorId).name;
         yield '\n';
      }

      yield $.ind;
      yield entry === null ? '*' : entry;
      if (alias) {
         yield ` as: ${alias}`;
      }
      yield '\n';
   }
}
sortedImportsInto ::= function (mid, G) {
   let imports = Array.from($.trie.values($.trie.at(G.imports.into, mid, $.trie.makeEmpty)));
   imports.sort((i1, i2) => $.compareImports(i1, i2, G));
   return imports;
}
compareImports ::= function (i1, i2, G) {
   if (i1.donorid !== i2.donorid) {
      let name1 = $.trie.at(G.modules.byId, i1.donorid).name;
      let name2 = $.trie.at(G.modules.byId, i2.donorid).name;
      return (name1 < name2) ? -1 : 1;
   }

   if (i1.entry === null) {
      return -1;
   }
   if (i2.entry === null) {
      return 1;
   }

   return (i1.entry < i2.entry) ? -1 : i1.entry > i2.entry ? 1 : 0;
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
map ::= function* (itbl, fn) {
   for (let x of itbl) {
      yield fn(x);
   }
}
newObj ::= function (proto, ...props) {
   return Object.assign(Object.create(proto), ...props);
}
