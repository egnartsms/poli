import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [
   {
      input: 'bootstrap/loader.js',
      output: {
         file: 'gen/loader.js',
         format: 'iife',
         name: 'poli'
      },
      plugins: [
         nodeResolve(),
         commonjs()
      ]
   }
];
