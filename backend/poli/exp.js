-----
cursiveDidNotChange ::= function (name) {
   return "Burn in hell, " + name + "!";
}
privetor ::= function (name) {
   return "Hello, " + name + "!";
}
greater ::= function () {
   let x = $.callme() * 2;
   return x + 1;
}
combox ::= function (name) {
   return $.privetor($.privetor(name));
}
callOut ::= function () {
   return 'callme' + $.cursiveDidNotChange("Joe");
}
