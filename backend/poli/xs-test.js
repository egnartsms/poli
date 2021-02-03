xs-printer
   serializeSyntax
xs-reader
   read1FromString
xs-tokenizer
   tokenizeString
-----
assert ::= $_.require('assert').strict
util ::= $_.require('util')
text1 ::= String.raw`
square-equation ::=
   fn :(a b c)
      let D =
         -
            Math.pow b 2
            * 4 a c
      
      cond
         if:
               < D 0
            return (<arr>)
         
         if: (= D 0)
            return
               <arr>
                  / (- b) (* 2 a)
         
         \ 
         \
         
         otherwise:
            return
               <arr>
                     "double indentation"
                  /
                     + (- b) (Math.pow D .5)
                     * 2 a
                  /
                     - (- b) (Math.pow D .5)
                     * 2 a
`.slice(1)
text2 ::= String.raw`
fuck-you ::=
   \ (30 as: 40 50 only-if-greater-than: (get-minimum-width))`.slice(1)
test ::= function () {
   let obj = $.read1FromString($.text1);
   console.log(`---\n${$.serializeSyntax(obj)}---\n`);
   //console.log($.util.inspect(obj, {depth: null}));
}
test2 ::= function () {
   console.log(Array.from($.tokenizeString($.text1)));
}
