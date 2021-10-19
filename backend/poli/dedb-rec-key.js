common
   check
dedb-common
   RecordType
-----
recKey ::= Symbol.for('poli.recKey')
recVal ::= Symbol.for('poli.recVal')
normalizeAttrsForPk ::= function (attrs) {
   let recType, plainAttrs;

   $.check(attrs.length > 0);

   if (attrs[0] === $.recKey) {
      $.check(attrs.length >= 2);

      if (attrs.length === 2 && attrs[1] === $.recVal) {
         recType = $.RecordType.keyVal;
         plainAttrs = null;
      }
      else {
         $.check(!attrs.includes($.recVal, 1), `recVal attribute misused`);

         recType = $.RecordType.keyTuple;
         plainAttrs = attrs.slice(1);
      }
   }
   else {
      $.check(
         !attrs.includes($.recKey) && !attrs.includes($.recVal),
         `recKey/recVal attribute misused`
      );

      recType = $.RecordType.tuple;
      plainAttrs = attrs;
   }

   return {recType, plainAttrs};
}
