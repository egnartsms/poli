common
   check
-----
recKey ::= Symbol.for('poli.recKey')
recVal ::= Symbol.for('poli.recVal')
recAttr ::= function (rec, attr, keyed) {
   return keyed !== false ?
         attr === $.recKey ? rec[0] :
         attr === $.recVal ? rec[1] : rec[1][attr]
      : rec[attr];
}
isKeyedRelUnwrapped ::= function (rel) {
   return rel.attrs === $.recVal;
}
plainAttrs ::= function (attrs) {
   if (attrs[0] === $.recKey) {
      if (attrs[1] === $.recVal) {
         return null;
      }
      else {
         return attrs.slice(1);
      }
   }
   else {
      return attrs;
   }
}
Keyed ::= ({
   wrapped: 'wrapped',
   direct: 'direct'
})
normalizeAttrsForPk ::= function (attrs, hasPrimaryKey, relname) {
   let keyed;

   if (hasPrimaryKey) {
      if (attrs === $.recVal) {
         attrs = [$.recKey, $.recVal];
         keyed = $.Keyed.direct;
      }
      else {
         $.check(attrs.length > 0, () =>
            `Relation '${relname}': empty array of attributes makes no sense`);
         $.check(!attrs.includes($.recVal) && !attrs.includes($.recKey), () =>
            `Relation '${relname}': recVal/recKey must not be included in the attrs array`
         );

         attrs.unshift($.recKey);
         keyed = $.Keyed.wrapped;
      }
   }
   else {
      $.check(Array.isArray(attrs) && attrs.length > 0, () =>
         `Relation '${relname}': expected non-empty array as attrs`
      );
      $.check(!attrs.includes($.recVal) && !attrs.includes($.recKey), () =>
         `Relation '${relname}': recVal/recKey must not be included in the attrs array`
      );

      keyed = false;
   }

   return {attrs, keyed};
}
recByKey ::= function (parent, recKey) {
   return parent.keyed === false ? recKey : parent.records.getEntry(recKey);
}
recKeyOf ::= function (parent, rec) {
   return parent.keyed === false ? rec : rec[0];
}
