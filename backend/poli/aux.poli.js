bootstrap
   moduleEval
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

   // Output $.testee, $.blah
   console.log("$.testee = ", ($.testee + $.testee) * $.testee);

   console.log($.multiply());
}
