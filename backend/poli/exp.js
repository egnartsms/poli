-----
cursiveDidNotChange ::= function (name) {
   return "Thrive in paradise, " + name + "!";
}
greeter ::= function (name) {
   return "Hello, " + name + "!";
}
moreThan ::= function () {
   let x = $.callHer() * 2;
   return x + 1;
}
combox ::= function (name) {
   return $.greeter($.greeter(name));
}
callHer ::= function () {
   return 'callme' + $.cursiveDidNotChange("Joe");
}
