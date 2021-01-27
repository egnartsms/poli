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
// <- entity.name.entry
// <- meta.entry.name
//     ^^^ punctuation.separator.poli.defined-as
//         ^^^^ meta.entry.def source.js

initDatabase ::= function () {
// ^^^^^^^^^ entity.name.entry
// ^^^^^^^^^ meta.entry.name

// <- meta.entry.def source.js
    console.log("Initialization");
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.entry.def source.js
}
