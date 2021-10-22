test-dedb-keyed
   * as: keyed
test-dedb-nonkeyed
   * as: nonkeyed
test-dedb-disjunction
   * as: disjunction
test-dedb-functional
   * as: functional
test-dedb-extver
   * as: extver
-----
runTests ::= function () {
   console.time('test-dedb');
   $.runTestsIn($.nonkeyed);
   $.runTestsIn($.keyed);
   $.runTestsIn($.disjunction);
   $.runTestsIn($.functional);
   $.runTestsIn($.extver);
   console.timeEnd('test-dedb')
}
runTestsIn ::= function (ns) {
   let setup = ns['setup'];

   for (let [k, v] of Object.entries(ns)) {
      if (k.startsWith('test_')) {
         let t0 = performance.now();
         
         try {
            let rels = setup ? setup() : undefined;
            v(rels);
         }
         catch (e) {
            let t1 = performance.now();
            console.log(`${k}: failed (${(t1 - t0).toFixed(2)} ms)`);
            throw e;
         }
         
         let t1 = performance.now();
         console.log(`${k}: passed (${(t1 - t0).toFixed(2)} ms)`);
      }
   }
}