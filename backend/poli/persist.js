bootstrap
   flushUow
   makeUow
   saveObject
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
