// SYNTAX TEST "Packages/Poli/JS.sublime-syntax"
some/nested/module
// <- meta.import.poli.module
    * as xmod
//  ^ meta.import.poli.asterisk
//    ^^ keyword.control.import-export.poli
//       ^^^^ meta.import.poli.alias
    hey as my_hey
//  ^^^ meta.import.poli.entry
//      ^^ keyword.control.import-export.poli
//         ^^^^^^ meta.import.poli.alias
-----
server ::= null
// <- entity.name.key.poli
//     ^^^ punctuation.separator.poli
//         ^^^^ source.js

initDatabase ::=
// ^^^^^^^^^ entity.name.key.poli
function () {
// <- source.js
    console.log("Initialization");
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.js
}
