trie
   * as: trie
-----
isA ::=
   function (obj, ...classes) {
      for (let cls of classes) {
         if (obj.class[cls.name] === true) {
            return true;
         }
      }
      
      return false;
   }

check ::=
   function (cond, msg=`Check failed`) {
      if (!cond) {
         throw new Error(typeof msg === 'function' ? msg() : msg);
      }
   }

checkThrows ::=
   function (callback) {
      try {
         callback();
      }
      catch (e) {
         return;
      }

      throw new Error(`Expected to have thrown but didn't`);
   }

assert ::=
   function (callback) {
      if (!callback()) {
         throw new Error(`Assert failed`);
      }
   }

obj2id ::= new WeakMap()
nextObjId ::= 1
objId ::=
   function (obj) {
      let id = $.obj2id.get(obj);
      if (id === undefined) {
         id = $.nextObjId++;
         $.obj2id.set(obj, id);
      }
      return id;
   }

hasOwnProperty ::=
   function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
   }


hasOwnDefined ::=
   function (obj, prop) {
      return Object.hasOwn(obj, prop) && obj[prop] !== undefined;
   }


ownPropertyValue ::=
   function (obj, prop) {
      return $.hasOwnProperty(obj, prop) ? obj[prop] : undefined;
   }

isObjectWithOwnProperty ::=
   function (obj, prop) {
      return obj != null && Object.hasOwn(obj, prop);
   }

selectProps ::=
   function (obj, props) {
      return Object.fromEntries(props.map(p => [p, obj[p]]));
   }

arrayify ::=
   function (X) {
      return X instanceof Array ? X : Array.from(X);
   }

settify ::=
   function (X) {
      return X instanceof Set ? X : new Set(X);
   }


wrapWith ::=
   function (designator, value) {
      return {
         [designator]: value
      }
   }


isWrappedWith ::=
   function (designator, value) {
      return value != null && Object.hasOwn(value, designator)
   }


compare ::=
   function (x1, x2) {
      return x1 < x2 ? -1 : x1 > x2 ? 1 : 0;
   }

compareArrays ::=
   function (a1, a2) {
      for (let i = 0; i < a1.length && i < a2.length; i += 1) {
         let c = $.compare(a1[i], a2[i]);
         if (c !== 0) {
            return c;
         }
      }

      return (i === a1.length) ? (i === a2.length ? 0 : -1) : 1;
   }

joindot ::=
   function (starName, entryName) {
      return starName + '.' + entryName;
   }

ind ::= '   '

dumpImportSection ::=
   function (mid, G) {
      let pieces = [];
      for (let piece of $.genImportSection(mid, G)) {
         pieces.push(piece);
      }

      return pieces.join('');
   }

genImportSection ::=
   function* (module) {
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

compareImports ::=
   function (i1, i2) {
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

propagateValueToRecipients ::=
   function (module, name) {
      let val = $.rtget(module, name);
      for (let imp of $.importsOf(module, name)) {
         $.rtset(imp.recp, $.importedAs(imp), val);
      }
   }

moduleNames ::=
   function (module) {
      return [...module.entries, ...module.importedNames];
   }


greatestBy ::=
   function (items, keyOf, {greaterThan=-Infinity}={}) {
      let maxKey = greaterThan;
      let maxItem = undefined;

      for (let item of items) {
         let key = keyOf(item);

         if (key > maxKey) {
            maxKey = key;
            maxItem = item;
         }
      }

      return maxItem;
   }


leastBy ::=
   function (items, keyOf) {
      let lessThan, minimum;

      if (typeof keyOf === 'function') {
         lessThan = Infinity;
         minimum = -Infinity;
      }
      else {
         ({lessThan=Infinity, minimum=-Infinity, keyOf} = keyOf);
      }

      let minKey = lessThan;
      let minItem = undefined;

      for (let item of items) {
         let key = keyOf(item);

         if (key < minKey) {
            minKey = key;
            minItem = item;

            if (minKey <= minimum) {
               break;
            }
         }
      }

      return minItem;
   }


isIterableEmpty ::=
   function (Xs) {
      let itor = Xs[Symbol.iterator]();
      let {done} = itor.next();

      return done;
   }

extendArray ::=
   function (A, X) {
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

isSubset ::=
   function (X, Y) {
      Y = $.settify(Y);

      for (let x of X) {
         if (!Y.has(x)) {
            return false;
         }
      }

      return true;
   }

setsIntersect ::=
   function (s1, s2) {
      if (s1.size > s2.size) {
         [s1, s2] = [s2, s1];
      }

      for (let x of s1) {
         if (s2.has(x)) {
            return true;
         }
      }

      return false;
   }

setWeedOut ::=
   function (set, pred) {
      let weed = new Set;

      for (let x of set) {
         if (!pred(x)) {
            set.delete(x);
            weed.add(x);
         }
      }

      return weed;
   }


arrayChain ::=
   function arrayChain(array, startFrom=0) {
      if (startFrom >= array.length) {
         return null;
      }
      else {
         return {
            item: array[startFrom],
            next() {
               return arrayChain(array, startFrom + 1);
            }
         }
      }
   }


isChainEmpty ::=
   function (chain) {
      return chain === null;
   }

yreExec ::=
   function (re, offset, str) {
      $.check(re.sticky);
      re.lastIndex = offset;
      return re.exec(str);
   }

yreTest ::=
   function (re, offset, str) {
      $.check(re.sticky);
      re.lastIndex = offset;
      return re.test(str);
   }

parameterize ::=
   function (tobind, callback) {
      $.check(tobind.length % 2 === 0);
      
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


sortedArray ::=
   function (itbl, keyfn) {
      let array = Array.from(itbl);

      array.sort((a, b) => {
         let ka = keyfn(a), kb = keyfn(b);

         return ka < kb ? -1 : ka > kb ? 1 : 0;
      });

      return array;
   }


lessThan ::=
   function (a, b) {
      return a < b;
   }


objLessThan ::=
   function (objA, objB) {
      return $.objId(objA) < $.objId(objB);
   }


equal ::=
   function equal(a, b) {
      return a === b;
   }


firstDuplicate ::=
   function (itbl) {
      let set = new Set;

      for (let x of itbl) {
         if (set.has(x)) {
            return x;
         }

         set.add(x);
      }
   }


itorFinal ::=
   function (itor) {
      let finalItem = undefined;

      for (let item of itor) {
         finalItem = item;
      }

      return finalItem;
   }


find ::=
   function (itbl, pred) {
      if (Array.isArray(itbl)) {
         return itbl.find(pred);
      }
      
      for (let x of itbl) {
         if (pred(x)) {
            return x;
         }
      }
   }


findIndex ::=
   function (itbl, pred) {
      let i = -1;

      for (let x of itbl) {
         i += 1;
         if (pred(x)) {
            return i;
         }
      }

      return -1;
   }


indexOf ::=
   function (itbl, item) {
      let i = -1;

      for (let x of itbl) {
         i += 1;
         if (x === item) {
            return i;
         }
      }

      return -1;
   }


arraysEqual ::=
   function (A, B, itemsEqual=$.equal) {
      if (A.length !== B.length) {
         return false;
      }

      for (let i = 0; i < A.length; i += 1) {
         if (!itemsEqual(A[i], B[i])) {
            return false;
         }
      }
      return true;
   }


setsEqual ::=
   function (A, B) {
      if (A.size !== B.size) {
         return false;
      }

      for (let a of A) {
         if (!B.has(a)) {
            return false;
         }
      }

      for (let b of B) {
         if (!A.has(b)) {
            return false;
         }
      }

      return true;
   }


allEqual ::=
   function (xs, pred) {
      let xi = xs[Symbol.iterator]();

      let prev, done;

      ({done, value: prev} = xi.next());
      
      if (done) {
         return true;
      }

      for (;;) {
         let item;
         ({done, value: item} = xi.next());

         if (done) {
            break;
         }

         if (!pred(prev, item)) {
            return false;
         }

         prev = item;
      }

      return true;      
   }


isLike ::=
   function isLike(A, B) {
      if (A === B) {
         return true;
      }

      if (B instanceof Array) {
         if (!(A instanceof Array) || A.length !== B.length) {
            return false;
         }
         for (let i = 0; i < A.length; i += 1) {
            if (!isLike(A[i], B[i])) {
               return false;
            }
         }
         return true;
      }

      if (B instanceof Set) {
         A = new Set(A);

         if (A.size !== B.size) {
            return false;
         }

         loop:
         for (let b of B) {
            for (let a of A) {
               if (isLike(a, b)) {
                  A.delete(a);
                  continue loop;
               }
            }
            return false;
         }

         return true;
      }

      if (B instanceof Map) {
         throw new Error(`Not implemented`);

         if (!(B instanceof Array)) {
            return false;
         }

         B = new Map(B);

         if (A.size !== B.size) {
            return false;
         }

         loop:
         for (let [ak, av] of A) {
            if (!B.has(ak)) {
               return false;
            }

            let bv = B.get(ak);
            B.delete(ak);

            if (!isLike(av, bv)) {
               return false;
            }
         }

         if (B.size > 0) {
            return false;
         }

         return true;
      }
      
      if (typeof B === 'object') {
         if (typeof A !== 'object') {
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


checkLike ::=
   function (A, B) {
      $.check($.isLike(A, B));
   }


enumerate ::=
   function* (xs) {
      let i = 0;

      for (let x of xs) {
         yield [i, x];
         i += 1;
      }
   }

zip ::=
   function* (xs, ys) {
      let xi = xs[Symbol.iterator]();
      let yi = ys[Symbol.iterator]();

      for (;;) {
         let {done: done_x, value: x} = xi.next();
         let {done: done_y, value: y} = yi.next();

         if (done_x || done_y) {
            break;
         }

         yield [x, y];
      }
   }

any ::=
   function (itbl, pred) {
      for (let x of itbl) {
         if (pred(x)) {
            return true;
         }
      }

      return false;
   }

notAny ::=
   function (xs, pred) {
      for (let x of xs) {
         if (pred(x)) {
            return false;
         }
      }

      return true;
   }

all ::=
   function (itbl, pred) {
      for (let x of itbl) {
         if (!pred(x)) {
            return false;
         }
      }

      return true;
   }

map ::=
   function* (xs, fn) {
      for (let x of xs) {
         yield fn(x);
      }
   }

filter ::=
   function* (itbl, filter) {
      for (let x of itbl) {
         if (filter(x)) {
            yield x;
         }
      }
   }

mapfilter ::=
   function* (itbl, fn) {
      for (let x of itbl) {
         let y = fn(x);
         if (y !== undefined) {
            yield y;
         }
      }
   }

concat ::=
   function (...Xs) {
      return $.chain(Xs);
   }

chain ::=
   function* (Xs) {
      for (let X of Xs) {
         yield* X;
      }
   }


takeWhile ::=
   function* (xs, pred) {
      for (let x of xs) {
         if (pred(x)) {
            yield x;
         }
      }
   }


mapStop ::=
   function* (xs, fnMapper) {
      for (let x of xs) {
         let y = fnMapper(x);

         if (y === undefined) {
            break;
         }

         yield y;
      }
   }


reduce ::=
   function (xs, rfn) {
      let accum = undefined;

      for (let x of xs) {
         if (accum === undefined) {
            accum = x;
         }
         else {
            accum = rfn(accum, x);
         }
      }

      return accum;
   }

omitted ::= new Object

trackingFinal ::=
   function* (xs) {
      let prev = $.omitted;

      for (let x of xs) {
         if (prev !== $.omitted) {
            yield [prev, false];
         }
         prev = x;
      }

      if (prev !== $.omitted) {
         yield [prev, true];
      }
   }

produceArray ::=
   function (N, producer) {
      let array = new Array(N);

      for (let i = 0; i < N; i += 1) {
         array[i] = producer(i);
      }

      return array;
   }

indexRange ::=
   function* (array) {
      yield* $.range(array.length);
   }


range ::=
   function* (to) {
      for (let i = 0; i < to; i += 1) {
         yield i;
      }
   }


newObj ::=
   function (proto, ...props) {
      return Object.assign(Object.create(proto), ...props);
   }

keyForValue ::=
   function (obj, val) {
      for (let [k, v] of Object.entries(obj)) {
         if (v === val) {
            return k;
         }
      }
   }

hasNoEnumerableProps ::=
   function (obj) {
      for (let prop in obj) {
         return false;
      }

      return Object.getOwnPropertySymbols(obj).length === 0;
   }

ownEntries ::=
   function* (obj) {
      for (let key of Reflect.ownKeys(obj)) {
         yield [key, obj[key]];
      }
   }

noUndefinedProps ::=
   function (obj) {
      if ($.notAny(Reflect.ownKeys(obj), key => obj[key] === undefined)) {
         return obj;
      }
      
      return Object.fromEntries(
         $.filter($.ownEntries(obj), ([k, v]) => v !== undefined)
      );
   }

commonArrayPrefixLength ::=
   function (A1, A2) {
      let i = 0;
      while (i < A1.length && i < A2.length && A1[i] === A2[i]) {
         i += 1;
      }

      return i;
   }

singleQuoteJoinComma ::=
   function (strs) {
      return Array.from(strs, s => `'${s}'`).join(', ');
   }

multimap ::=
   function () {
      return new Map;
   }

mmapAdd ::=
   function (mmap, key, val) {
      let bag = mmap.get(key);

      if (bag === undefined) {
         bag = new Set();
         mmap.set(key, bag);
      }

      bag.add(val);
   }

mmapDelete ::=
   function (mmap, key, val) {
      let bag = mmap.get(key);

      if (bag === undefined) {
         return false;
      }

      let didDelete = bag.delete(val);

      if (bag.size === 0) {
         mmap.delete(key);
      }

      return didDelete;
   }

mmapAddAll ::=
   function (mmap, key, vals) {
      let bag = mmap.get(key);

      if (bag === undefined) {
         bag = new Set(vals);
         mmap.set(key, bag);
      }
      else {
         for (let val of vals) {
            bag.add(val);
         }
      }
   }

mmapDeleteAll ::=
   function (mmap, key) {
      return mmap.delete(key);
   }

one2many ::=
   function (syn_one, syn_many) {
      let o2m = {
         one: $.multimap(),
         many: new Map
      };

      if (syn_one !== undefined) {
         $.assert(() => syn_one !== 'one' && syn_one !== 'many');
         o2m[syn_one] = o2m.one;
      }
      if (syn_many !== undefined) {
         $.assert(() => syn_many !== 'one' && syn_many !== 'many');
         o2m[syn_many] = o2m.many;
      }

      return o2m;
   }

o2mAdd ::=
   function (o2m, x1, xM) {
      if (o2m.many.has(xM)) {
         throw new Error(`One-to-many violation`);
      }

      $.mmapAdd(o2m.one, x1, xM);
      o2m.many.set(xM, x1);
   }

m2mCompanion ::= Symbol.for('poli.m2m.companion')

many2many ::=
   function () {
      let l2r = $.multimap();
      let r2l = $.multimap();

      l2r[$.m2mCompanion] = r2l;
      r2l[$.m2mCompanion] = l2r;

      return [l2r, r2l];
   }

m2mHas ::=
   function (mm, a, b) {
      return mm.has(a) && mm.get(a).has(b);
   }

m2mAdd ::=
   function (mm, a, b) {
      $.mmapAdd(mm, a, b);
      $.mmapAdd(mm[$.m2mCompanion], b, a);
   }

m2mAddAll ::=
   function (mm, a, bs) {
      $.mmapAddAll(mm, a, bs);

      for (let b of bs) {
         $.mmapAdd(mm[$.m2mCompanion], b, a);
      }
   }


Queue ::=
   {
      new(items) {
         return {
            front: [],
            rear: items == null ? [] : [...items]
         }
      },

      put(queue, item) {
         queue.rear.push(item);
      },

      putAll(queue, items) {
         for (let item of items) {
            $.Queue.put(queue, item);
         }
      },

      take(queue) {
         if (queue.front.length === 0) {
            $.rearToFront(queue);
         }

         return queue.front.pop();
      },

      isEmpty(queue) {
         return queue.front.length === 0 && queue.rear.length === 0;
      }
   }


rearToFront ::=
   function (queue) {
      let {front, rear} = queue;

      while (rear.length > 0) {
         front.push(rear.pop());
      }
   }


breadthExpansion ::=
   function (initial, gtor) {
      let belt = $.Queue.new();

      $.Queue.put(belt, initial);

      while (!$.Queue.isEmpty(belt)) {
         let item = $.Queue.take(belt);
         $.Queue.putAll(belt, gtor(item));
      }
   }
