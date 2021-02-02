xs-tokenizer
   tokenize
-----
text1 ::= String.raw`
entry-name ::=
   #;  i don't really ; know
      what this is all about
   
      continuation of the comment 
   + 1
      fn :()
         if (=== this.width 0)
            console.log "Yes!  na"
            
            \ 30
            \ ...
            \ (+ a b) (* c d 3)
`.slice(1)
test ::= function () {
   console.log($.tokenize($.text1));
}
