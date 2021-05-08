-----
cursiveDidNotChange ::= function (name) {
   return "Burn in hell, " + name + "!";
}
salutor ::= function (name) {
   return "Hello, " + name + "!";
}
greater ::= function () {
   let x = $.callme() * 2;
   return x + 1;
}
combox ::= function (name) {
   return $.salutor($.salutor(name));
}
callOut ::= function () {
   return 'callme' + $.cursiveDidNotChange("Joe");
}
