bootstrap
   assert
   hasOwnProperty
xs-finalizer
   globalNames
   isGlobalName
   isModuleEntryName
-----
CompilerError ::= class extends Error {}
result ::= null
module ::= null
entry ::= null
env ::= null
emit ::= function (s) {
   $.result.push(s);
}
