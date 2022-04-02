function run(N) {
   let A = [];

   for (let i = 0; i < N; i += 1) {
      A.push(new Map);
   }

   global.A = A;
}


function main() {
   const N = 10_000;

   let before = process.memoryUsage().heapUsed;
   run(N);
   gc();
   let after = process.memoryUsage().heapUsed;

   console.log("Unit takes up: ", (after - before) / N);
}

if (require.main === module) {
   main();
}
