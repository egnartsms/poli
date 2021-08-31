test-prolog-keyed
   * as: keyed
test-prolog-nonkeyed
   * as: nonkeyed
-----
runTests ::= function () {
   $.keyed.runTests();
   $.nonkeyed.runTests();
}
