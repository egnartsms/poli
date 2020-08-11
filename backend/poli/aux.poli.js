bootstrap
   moduleEval
img2fs
   sortedImportsInto
-----
add ::= function (x, y) {
   return x + y;
}
multiply ::= function (x, y) {
   return x * y;
}
sayhello ::= function () {
   console.log("No matter");
   return {'testee': $.testee};
}
compareImports ::= function () {
   $.moduleEval();

   // Output $.testee
   console.log("testee = ", ($.testee + $.testee) * $.testee);

   console.log($.fuckYaro());
}
