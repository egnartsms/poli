common
   check
-----
recKey ::= Symbol.for('poli.recKey')
recVal ::= Symbol.for('poli.recVal')

normalizeAttrs ::=
   function (recType, plainAttrs) {
      let attrs;

      $.check(!plainAttrs.includes($.recKey) && !plainAttrs.includes($.recVal));

      if (recType === $.RecordType.tuple) {
         $.check(plainAttrs.length > 0);

         return Array.from(plainAttrs);
      }
      else if (recType === $.RecordType.keyTuple) {
         $.check(plainAttrs.length > 0);
         
         return [$.recKey, ...plainAttrs];
      }
      else if (recType === $.RecordType.keyVal) {
         $.check(plainAttrs.length === 0);

         return [$.recKey, $.recVal];
      }
   }
