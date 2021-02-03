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
         abc :(a b c) 20
         cxt.set-line-dash 30
         cxt.setColor "red"
n ::= "luck"
next ::=
   fuck-you
fuck-you ::=
   \ (30 as: 40 50 only-if-greater-than: (get-minimum-width))
