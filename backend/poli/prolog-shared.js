-----
recKey ::= Symbol.for('poli.recKey')
recVal ::= Symbol.for('poli.recVal')
recAttr ::= function (rec, attr, isKeyed) {
   return isKeyed ?
         attr === $.recKey ? rec[0] :
         attr === $.recVal ? rec[1] : rec[1][attr]
      : rec[attr];
}
