xs-printer
   dumpsNext
-----
assert ::= $_.require('assert').strict
entryTextDef ::= function (module, entry) {
   if (module.lang === 'js') {
      return module.defs[entry];
   }
   
   if (module.lang === 'xs') {
      return $.dumpsNext(module.defs[entry].stx, 0);
   }
   
   throw new Error;
}
