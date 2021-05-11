common
   hasOwnProperty
vector
   * as: vec
   at
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
   let v = $.vec.Vector(['a', 'b', 'c']);
   return $.vec.at(v, 2);
}
callHim ::= function () {
   let v = ['a', 'b', 'c'];
   return v[2];
}
