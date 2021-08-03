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
isObjectWithOwnProperty ::= function (obj, prop) {
   return obj != null && $.hasOwnProperty(obj, prop);
}
selectProps ::= function (obj, props) {
   return Object.fromEntries(props.map(p => [p, obj[p]]));
}
patchObj ::= function (obj, patch) {
   return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj, patch);
}
patchNullableObj ::= function (obj1, obj2) {
   if (obj2 == null) {
      return obj1;
   }
   
   return {...obj1, ...obj2};
}
compare ::= function (x1, x2) {
   return x1 < x2 ? -1 : x1 > x2 ? 1 : 0;
}
compareArrays ::= function (a1, a2) {
   for (let i = 0; i < a1.length && i < a2.length; i += 1) {
      let c = $.compare(a1[i], a2[i]);
      if (c !== 0) {
         return c;
      }
   }

   return (i === a1.length) ? (i === a2.length ? 0 : -1) : 1;
}
joindot ::= function (starName, entryName) {
   return starName + '.' + entryName;
}
ind ::= '   '
dumpImportSection ::= function (mid, G) {
   let pieces = [];
   for (let piece of $.genImportSection(mid, G)) {
      pieces.push(piece);
   }

   return pieces.join('');
}
genImportSection ::= function* (module) {
   let imports = $.trie.valuesArray(module.imports);
   imports.sort($.compareImports);

   let curDonor = null;

   for (let {entry, recp, alias, as} of imports) {
      if (entry.v.module !== curDonor) {
         curDonor = entry.v.module;
         yield entry.v.module.v.name;
         yield '\n';
      }

      yield $.ind;
      yield entry.v.name === null ? '*' : entry.v.name;
      if (alias) {
         yield ` as: ${alias}`;
      }
      yield '\n';
   }
}
compareImports ::= function (i1, i2) {
   if (i1.entry.v.module !== i2.entry.v.module) {
      return $.compare(i1.entry.v.module.v.name, i2.entry.v.module.v.name);
   }

   if (i1.entry.v.name === null) {
      return -1;
   }
   if (i2.entry.v.name === null) {
      return 1;
   }

   return $.compare(i1.entry.v.name, i2.entry.v.name);
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
objLessThan ::= function (objA, objB) {
   return $.objId(objA) < $.objId(objB);
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
find ::= function (itbl, pred) {
   if (Array.isArray(itbl)) {
      return itbl.find(pred);
   }
   
   for (let x of itbl) {
      if (pred(x)) {
         return x;
      }
   }
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
areArraysEqual ::= function (A, B) {
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
isLike ::= function isLike(A, B) {
   if (A === B) {
      return true;
   }
   if (A instanceof Array) {
      if (!(B instanceof Array) || A.length !== B.length) {
         return false;
      }
      for (let i = 0; i < A.length; i += 1) {
         if (!isLike(A[i], B[i])) {
            return false;
         }
      }
      return true;
   }
   if (A instanceof Set) {
      if (!(B instanceof Array)) {
         return false;
      }

      B = new Set(B);

      if (A.size !== B.size) {
         return false;
      }

      loop:
      for (let a of A) {
         for (let b of B) {
            if (isLike(a, b)) {
               B.delete(b);
               continue loop;
            }
         }
         return false;
      }

      return true;
   }

   if (typeof A === 'object') {
      if (typeof B !== 'object') {
         return false;
      }

      if (A === null || B === null) {
         return false;
      }

      for (let [p, b] of Object.entries(B)) {
         if (!$.hasOwnProperty(A, p) || !isLike(A[p], b)) {
            return false;
         }
      }

      return true;
   }

   return false;
}
map ::= function* (itbl, fn) {
   for (let x of itbl) {
      yield fn(x);
   }
}
mapfilter ::= function* (itbl, fn) {
   for (let x of itbl) {
      let y = fn(x);
      if (y !== undefined) {
         yield y;
      }
   }
}
concat ::= function* (...itbls) {
   for (let itbl of itbls) {
      yield* itbl;
   }
}
filter ::= function* (itbl, filter) {
   for (let x of itbl) {
      if (filter(x)) {
         yield x;
      }
   }
}
trackingFinal ::= function* (itbl) {
   let itor = itbl[Symbol.iterator]();
   let {value, done} = itor.next();

   while (!done) {
      let nextValue;

      ({value: nextValue, done} = itor.next());
      
      yield [value, done];
      value = nextValue;     
   }

   return value;
}
newObj ::= function (proto, ...props) {
   return Object.assign(Object.create(proto), ...props);
}
hasNoEnumerableProps ::= function (obj) {
   for (let prop in obj) {
      return false;
   }

   return true;
}
commonArrayPrefixLength ::= function (A1, A2) {
   let i = 0;
   while (i < A1.length && i < A2.length && A1[i] === A2[i]) {
      i += 1;
   }

   return i;
}
singleQuoteJoinComma ::= function (strs) {
   return Array.from(strs, s => `'${s}'`).join(', ');
}