// SYNTAX TEST "Packages/Poli/Poli-JS.sublime-syntax"

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
