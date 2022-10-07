_  SYNTAX TEST "Packages/Poli/Poli.sublime-syntax"
some/nested/module
_  <- meta.import.module
    * as: xmod
_   ^ meta.import.asterisk
_     ^^^ keyword.other
_         ^^^^ meta.import.alias
    hey as: my_hey
_   ^^^ meta.import.entry
_       ^^ keyword.other
_           ^^^^^^ meta.import.alias
-----
server ::= null
_  <- meta.target meta.name-binding
_      ^^^ punctuation.separator.defined-as
_          ^^^^ meta.body.oneline meta.definition

initDatabase :js:=
   :Initial the database
_  ^ punctuation.definition.docstring
_   ^^^^^^^^^^^^^^^^^^^^ meta.docstring

_  <- meta.docstring
    More elaborate description that follows.

_  <- meta.docstring
    return: undefined
_   ^^^^^^^^^^^^^^^^^ meta.docstring

_  <- meta.body.multiline meta.definition
   function () {
      console.log("Initialization");
      
_  <- meta.body.multiline meta.definition
      console.log("Deinitialization")
   }

_  <- meta.body.multiline meta.definition
   redundant_but_part_of_definition(1, 2, 3);
_  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.body.multiline meta.definition

_ <- meta.interspace
The sky is blue. Cuis, Pharo, Squeak, Dolphin.
_ <- meta.interspace


_ <- meta.interspace
And others
_ <- meta.interspace

$.effect arg1(), arg2(), arg3() ::=
_  <- meta.target
_ ^^^^^^ meta.target meta.$func
_        ^^^^^^^^^^^^^^^^^^^^^^ meta.target meta.$args
   follows();
_  ^^^^^^^^^^ meta.body.multiline meta.definition
   body();
