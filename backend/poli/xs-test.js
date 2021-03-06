xs-printer
   multilined2str
xs-reader
   read1FromString
xs-tokenizer
   tokenizeFromNewline
-----
util ::= $_.require('util')
text ::= String.raw`
square-equation ::=$
   fn :(a b c)
      let D =
         -
            Math.pow b 2
            * 4 a c
      
      cond
            extra-indented-stuff
         normally-indented-stuff
         and-more
         
       default-body:
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
text1 ::= 'that will be set at runtime'
testTok ::= function () {
   console.time();
   for (let i = 0; i < 10_000; i += 1) {
      let gtor = $.tokenizeFromNewline($.text);
      let arr = Array.from(gtor);
      if (arr.length > 1_000_000) {
         console.log("I will never be reached!")
      }
   }
   console.timeEnd();
}
testReader ::= function () {
   let obj1 = $.read1FromString($.text);
   $.text1 = $.multilined2str(obj1) + '\n';
   
   console.log("$.text1 === $.text", $.text1 === $.text);
}
