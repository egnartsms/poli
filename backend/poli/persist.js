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
   console.time('saveObject')
   for (let obj of $.dirties) {
      $.saveObject(obj, uow);
   }
   console.timeEnd('saveObject');
   console.time('flushUow');
   $.flushUow(uow);
   console.timeEnd('flushUow');
   $.dirties.clear();
}
