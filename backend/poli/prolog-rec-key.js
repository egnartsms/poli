common
   check
-----
recKey ::= Symbol.for('poli.recKey')
recVal ::= Symbol.for('poli.recVal')
makeRecAttrAccessor ::= function (keyed) {
   if (keyed === false) {
      return Reflect.get;
   }
   else if (keyed === $.Keyed.wrapped) {
      return function ([key, val], attr) {
         return attr === $.recKey ? key : val[attr];
      }
   }
   else if (keyed === $.Keyed.direct) {
      return function ([key, val], attr) {
         if (attr === $.recKey) {
            return key;
         }
         else if (attr === $.recVal) {
            return val;
         }
         else {
            throw new Error(
               `Access of attribute other than recKey or recVal on a Direct keyed ` +
               `relation`
            );
         }
      }
   }
   else {
      throw new Error;
   }
}
makeRecKeyAccessor ::= function (keyed) {
   return keyed === false ? (rec => rec) : (([key, val]) => key);
}
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
normalizeAttrsForPk ::= function (attrs) {
   let keyed, plainAttrs;

   $.check(attrs.length > 0);

   if (attrs[0] === $.recKey) {
      $.check(attrs.length >= 2);

      if (attrs.length === 2 && attrs[1] === $.recVal) {
         keyed = $.Keyed.direct;
         plainAttrs = null;
      }
      else {
         $.check(!attrs.includes($.recVal, 1), `recVal attribute misused`);

         keyed = $.Keyed.wrapped;
         plainAttrs = attrs.slice(1);
      }
   }
   else {
      $.check(
         !attrs.includes($.recKey) && !attrs.includes($.recVal),
         `recKey/recVal attribute misused`
      );

      keyed = false;
      plainAttrs = attrs;
   }

   return {keyed, plainAttrs};
}
recByKey ::= function (parent, recKey) {
   return parent.keyed === false ? recKey : parent.records.getEntry(recKey);
}
recKeyOf ::= function (parent, rec) {
   return parent.keyed === false ? rec : rec[0];
}
