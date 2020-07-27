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
   console.log('Hello!');
}
compareImports ::= function () {
   $.moduleEval();

   console.log("Done!");
}
