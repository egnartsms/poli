import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [
   {
      input: 'poli/load.js',
      output: {
         file: 'gen/load.js',
         format: 'iife',
         name: 'poli'
      },
      plugins: [
         nodeResolve(),
         commonjs()
      ]
   }
];
