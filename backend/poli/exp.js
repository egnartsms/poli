-----
callme ::= function () {
   return 30;
}
andMeToo ::= function () {
   let x = $.callme() * 2;
   return x + 1;
}
greeter ::= function (name) {
   return "Hello, " + name + "!";
}
curser ::= function (name) {
   return "Burn in hell, " + name + "!";
}
combo ::= function (name) {
   return $.greeter($.greeter(name));
}
