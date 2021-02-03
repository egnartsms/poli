lang-processor
   process
   flush
util
   rename
   with-flusher
   with-file
   * as: f
-----
remove-unused-imports-in-all-modules ::=
   fn :(a b c)
      return
         + a b
            \ c
         console.log.get-them-off "Uncontrolled code\\\" and luck: 20"
         abc :(a b c) 20 (fuck:)
         cxt.set-line-dash 30
         cxt.setColor "red"
n ::= "luck"
next ::=
   fuck-you
fuck-you ::=
   \ (30 as: 40 50 only-if-greater-than: (get-minimum-width))
solve-square-equation ::=
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
