-----
cursiveDidNotChange ::= function (name) {
   return "Thrive in paradise, " + name + "!";
}
saluter ::= function (name) {
   return "Hello, " + name + "!";
}
greater ::= function () {
   let x = $.callhim() * 2;
   return x + 1;
}
combox ::= function (name) {
   return $.saluter($.saluter(name));
}
callOut ::= function () {
   return 'callme' + $.cursiveDidNotChange("Joe");
}
