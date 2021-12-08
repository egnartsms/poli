dedb-relation
   clearRelationCache
test-dedb-base
   * as: base
test-dedb-derived
   * as: derived
test-dedb-keyed
   * as: keyed
test-dedb-disjunction
   * as: disjunction
test-dedb-functional
   * as: functional
test-dedb-extver
   * as: extver
-----
runTests ::= function () {
   console.time('tests');
   $.runTestsIn($.base);
   $.runTestsIn($.derived);
   // $.runTestsIn($.keyed);
   // $.runTestsIn($.disjunction);
   // $.runTestsIn($.functional);
   // $.runTestsIn($.extver);
   console.timeEnd('tests')
}
runTestsIn ::= function (ns) {
   $.clearRelationCache();

   for (let [k, v] of Object.entries(ns)) {
      if (k.startsWith('test_')) {
         let t0 = performance.now();
         
         try {
            v();
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