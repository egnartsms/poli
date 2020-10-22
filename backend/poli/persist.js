bootstrap
   addRecordedObjects
   isObject
   obj2id
   objrefRecorder
   skSet
-----
assert ::= $_.require('assert').strict
stmtSetProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_set(val, :path, json(:propval)) WHERE id = :oid
`)
stmtDeleteProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_remove(val, :path) WHERE id = :oid
`)
stmtDelete ::= $_.db.prepare(`
   DELETE FROM obj WHERE id = :oid
`)
dbSetProp ::= function (obj, ...pathvalPairs) {
   $.assert($.obj2id.has(obj));
   $.assert(pathvalPairs.length % 2 === 0);


   let rec = $.objrefRecorder();
   
   for (let i = 0; i < pathvalPairs.length; i += 2) {
      let path = pathvalPairs[i];
      let val = pathvalPairs[i + 1];

      $.stmtSetProp.run({
         oid: $.obj2id.get(obj),
         path: $.jsonPath(path),
         propval: $.toJsonRef(val, rec.ref)
      });
   }

   $.addRecordedObjects(rec);
}
dbDeleteProp ::= function (obj, prop) {
   $.assert($.obj2id.has(obj));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(obj),
      path: $.jsonPath(prop),
   });
}
setObjectProp ::= function (obj, prop, val) {
   $.dbSetProp(obj, prop, val);
   obj[prop] = val;
}
deleteObjectProp ::= function (obj, prop) {
   $.dbDeleteProp(obj, prop);
   delete obj[prop];
}
deleteArrayItem ::= function (ar, i) {
   $.assert($.obj2id.has(ar));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(ar),
      path: $.jsonPath(i),
   });
   ar.splice(i, 1);
}
deleteObject ::= function (obj) {
   $.assert($.obj2id.has(obj));

   $.stmtDelete.run({oid: $.obj2id.get(obj)});
   $.obj2id.delete(obj);
}
setAdd ::= function (set, item) {
   if (set.has(item)) {
      return false;
   }
   
   let aux = set[$.skSet];
   let newid = aux.nextid++;
   $.dbSetProp(set,
      [$.skSet, 'id2item', String(newid)], item,
      [$.skSet, 'nextid'], aux.nextid
   );
   aux.item2id.set(item, newid);
   set.add(item);

   return true;
}
setDelete ::= function (set, item) {
   if (!set.delete(item)) {
      return false;
   }

   let aux = set[$.skSet];
   let id = aux.item2id.get(item);
   $.dbDeleteProp(set, [$.skSet, 'id2item', String(id)]);
   aux.item2id.delete(item);

   return true;
}
toJsonRef ::= function (obj, ref) {
   // Convert to JSON but use reference even for obj itself
   if ($.isObject(obj)) {
      obj = ref(obj);
   }

   return JSON.stringify(obj);
}
jsonPath ::= function (path) {
   if (!(path instanceof Array)) {
      path = [path];
   }

   let pieces = ['$'];

   for (let step of path) {
      if (typeof step === 'string') {
         pieces.push('.' + step);
      }
      else if (typeof step === 'number') {
         pieces.push(`[${step}]`);
      }
      else {
         throw new Error(`Invalid JSON path item: ${step}`);
      }
   }

   return pieces.join('');

   // Sets
   //psetNew ::= function (items) {
   //   let pset = {
   //      [$.skPersistentType]: $.persistentType.set,
   //      nextid: 1,
   //      item2id: new Map
   //   };
   //
   //   for (let item of items || []) {
   //      $.psetAdd(pset, item);
   //   }
   //
   //   return pset;
   //}
   //psetHas ::= function (pset, item) {
   //   return pset.item2id.has(item);
   //}
   //psetAdd ::= function (pset, item) {
   //   if ($.psetHas(pset, item)) {
   //      return false;
   //   }
   //
   //   pset.item2id.set(item, pset.nextid++);
   //   return true;
   //}
   //psetDelete ::= function (pset, item) {
   //   return pset.item2id.delete(item);
   //}
   //psetIterate ::= function (pset) {
   //   return pset.item2id.keys();
   //}
}
