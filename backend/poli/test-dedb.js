dedb-query
   clearProjectionCache
test-dedb-base
   * as: base
test-dedb-base-entity
   * as: baseEntity
test-dedb-derived
   * as: derived
test-dedb-disjunction
   * as: disjunction
test-dedb-func-1
   * as: func1
test-dedb-func-2
   * as: func2
test-dedb-agg-1
   * as: agg1
-----

runTests ::=
   function () {
      console.time('tests');
      $.runTestsIn('base', $.base);
      //$.runTestsIn('base-entity', $.baseEntity);
      // $.runTestsIn('derived', $.derived);
      // $.runTestsIn('disjunction', $.disjunction);
      // $.runTestsIn('func-1', $.func1);
      // $.runTestsIn('func-2', $.func2);
      // $.runTestsIn('agg-1', $.agg1);
      // $.clearProjectionCache();
      console.log('--- DONE');
      console.timeEnd('tests')
   }

runTestsIn ::=
   function (moduleName, ns) {
      console.log('---', moduleName);

      for (let prop of Object.keys(ns)) {
         if (prop.startsWith('test_')) {
            ns['setup']();
            // $.clearProjectionCache();

            let t0 = performance.now();
            
            try {
               ns[prop]();
            }
            catch (e) {
               let t1 = performance.now();
               console.log(`${prop}: failed (${(t1 - t0).toFixed(2)} ms)`);
               throw e;
            }
            
            let t1 = performance.now();
            console.log(`${prop}: passed (${(t1 - t0).toFixed(2)} ms)`);
         }
      }
   }
   