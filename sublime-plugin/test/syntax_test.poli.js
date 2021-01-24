// SYNTAX TEST "Packages/Poli/JS.sublime-syntax"
some/nested/module
// <- meta.import.poli.module
    * as: xmod
//  ^ meta.import.poli.asterisk
//    ^^^ keyword.other
//        ^^^^ meta.import.poli.alias
    hey as: my_hey
//  ^^^ meta.import.poli.entry
//      ^^ keyword.other
//          ^^^^^^ meta.import.poli.alias
-----
server ::= null
// <- entity.name.poli
//     ^^^ punctuation.separator.poli.defined-as
//         ^^^^ source.js

initDatabase ::= function () {
// ^^^^^^^^^ entity.name.poli

// <- source.js
    console.log("Initialization");
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.js
}
