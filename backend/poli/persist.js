bootstrap
   assert
   flushUow
   isObject
   makeUow
   obj2id
   saveObject
   skSet
-----
dirties ::= new Set
markAsDirty ::= function (obj) {
   $.dirties.add(obj);
}
flush ::= function () {
   let uow = $.makeUow();
   for (let obj of $.dirties) {
      $.saveObject(obj, uow);
   }
   $.flushUow(uow);
   $.dirties.clear();
}
