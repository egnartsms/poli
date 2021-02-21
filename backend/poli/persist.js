bootstrap
   addRecordedObjects
   assert
   isObject
   obj2id
   objrefRecorder
   skSet
-----
stmtSetProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_set(val, :path, json(:propval)) WHERE id = :id
`)
stmtDeleteProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_remove(val, :path) WHERE id = :id
`)
dbSetProp ::= function (obj, ...pathvalPairs) {
   $.assert($.obj2id.has(obj));
   $.assert(pathvalPairs.length % 2 === 0);

   let rec = $.objrefRecorder();
   
   for (let i = 0; i < pathvalPairs.length; i += 2) {
      let path = pathvalPairs[i];
      let val = pathvalPairs[i + 1];

      $.stmtSetProp.run({
         id: $.obj2id.get(obj),
         path: $.jsonPath(path),
         propval: $.toJsonRef(val, rec.ref)
      });
   }

   $.addRecordedObjects(rec);
}
dbDeleteProp ::= function (obj, prop) {
   $.assert($.obj2id.has(obj));

   $.stmtDeleteProp.run({
      id: $.obj2id.get(obj),
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
      id: $.obj2id.get(ar),
      path: $.jsonPath(i),
   });
   ar.splice(i, 1);
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
}
