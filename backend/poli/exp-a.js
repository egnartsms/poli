common
   * as: common
   dumpImportSection
   hasOwnProperty
exc
   * as: exc
   ApiError
   detour as: dva
vector
   * as: vec
   at
xs-printer
   dumpComment as: fuck
-----
callHim ::=
   function () {
      return $.exc.detour() + '!';
   }

cursiveDidNotChange ::=
   function (name) {
      return $.dva();
   }

greeter ::=
   function (name) {
      return "Hello, " + name + "!";
   }

moreThan ::=
   function () {
      let x = $.callHer() * 2;
      return x + 1;
   }

combox ::=
   function (name) {
      return $.greeter($.greeter(name));
   }

callHer ::=
   function () {
      let v = $.vec.Vector(['a', 'b', 'c']);
      // return $.vec.at(v, 0);
      return 'Jane'
   }
