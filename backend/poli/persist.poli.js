bootstrap
   addRecordedObjects
   isObject
   metaRef
   obj2id
   objrefRecorder
   stmtInsert
   stmtUpdate
   takeNextOid
   toJson
run
   assert
-----
saveObject ::= function (obj) {
   $.assert($.isObject(obj));

   let oid = $.obj2id.get(obj);
   let json = $.toJson(obj, $.objrefMustExist);

   if (oid == null) {
      oid = $.takeNextOid();
      $.stmtInsert.run({oid, val: json});
      $.obj2id.set(obj, oid);
   }
   else {
      $.stmtUpdate.run({oid, val: json});
   }
}
setObjectProp ::= function (obj, prop, val) {
   $.assert($.obj2id.has(obj));

   let oid = $.obj2id.get(obj);
   let rec = $.objrefRecorder();
   let json = $.toJsonRef(val, rec.objref);

   $.stmtSetProp.run({
      oid,
      path: $.jsonPath(prop),
      propval: json
   });

   $.addRecordedObjects(rec);

   obj[prop] = val;
}
deleteObjectProp ::= function (obj, prop) {
   $.assert($.obj2id.has(obj));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(obj),
      path: $.jsonPath(prop),
   });
   delete obj[prop];   
}
deleteObject ::= function (obj) {
   $.assert($.obj2id.has(obj));

   $.stmtDelete.run({oid: $.obj2id.get(obj)});
   $.obj2id.delete(obj);
}
deleteArrayItem ::= function (ar, i) {
   $.assert($.obj2id.has(ar));

   $.stmtDeleteProp.run({
      oid: $.obj2id.get(ar),
      path: $.jsonPath(i),
   });
   ar.splice(i, 1);
}
stmtSetProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_set(val, :path, json(:propval)) WHERE id = :oid
`)
stmtDeleteProp ::= $_.db.prepare(`
   UPDATE obj SET val = json_remove(val, :path) WHERE id = :oid
`)
stmtDelete ::= $_.db.prepare(`
   DELETE FROM obj WHERE id = :oid
`)
toJsonRef ::= function (obj, objref) {
   // Convert to JSON but use reference even for obj itself
   if ($.isObject(obj)) {
      obj = objref(obj);
   }

   return JSON.stringify(obj);
}
jsonPath ::= function (...things) {
   let pieces = ['$'];
   for (let thing of things) {
      if (typeof thing === 'string') {
         pieces.push('.' + thing);
      }
      else if (typeof thing === 'number') {
         pieces.push(`[${thing}]`);
      }
      else {
         throw new Error(`Invalid JSON path item: ${thing}`);
      }
   }

   return pieces.join('');
}
objrefMustExist ::= function (obj) {
   let oid = $.obj2id.get(obj);
   if (oid == null) {
      throw new Error(`Stumbled upon an unsaved object: ${obj}`);
   }

   return {
      [$.metaRef]: oid
   };
}
