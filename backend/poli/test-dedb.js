dedb-query
   clearProjectionCache
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
-----
runTests ::= function () {
   console.time('tests');
   $.runTestsIn('base', $.base);
   $.runTestsIn('derived', $.derived);
   $.runTestsIn('keyed', $.keyed);
   $.runTestsIn('disjunction', $.disjunction);
   $.runTestsIn('functional', $.functional);
   $.clearProjectionCache();
   console.log('--- DONE');
   console.timeEnd('tests')
}
runTestsIn ::= function (moduleName, ns) {
   console.log('---', moduleName);

   ns['setup']();

   for (let [k, v] of Object.entries(ns)) {
      if (k.startsWith('test_')) {
         $.clearProjectionCache();

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