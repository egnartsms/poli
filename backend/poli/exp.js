-----
greeter ::= function (name) {
   return "Hello, " + name + "!";
}
combo ::= function (name) {
   return $.greeter($.greeter(name));
}
curser ::= function (name) {
   return "Burn in hell, " + name + "!";
}
andMeToo ::= function () {
   let x = $.callme() * 2;
   return x + 1;
}
callme ::= function () {
   return 'callme' + $.curser("Joe");
}
