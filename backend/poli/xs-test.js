xs-reader
   makeTokenStream
   move
   readMultilined
xs-tokenizer
   tokenizeString
-----
assert ::= $_.require('assert').strict
util ::= $_.require('util')
text1 ::= String.raw`
entry-name ::=
   fn :()
      console.log "Yes!  na"
      \
      
      \ 30
      \ ...
      \ (+ a b) (* c d 3) fuck: 20
`.slice(1)
test ::= function () {
   // console.log(Array.from($.tokenizeString($.text1)));
   let stm = $.makeTokenStream($.text1);

   $.move(stm);
   $.assert(stm.next.token === 'indent');
   $.move(stm);
   
   let obj = $.readMultilined(stm, 0);
   console.log($.util.inspect(obj, {depth: null}));
}
