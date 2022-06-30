
// const nodeResolve = require('rollup-plugin-node-resolve');
// const commonjs = require('rollup-plugin-commonjs');
// import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [
   {
      input: 'js/bootstrap.js',
      output: {
         file: 'script/bootstrap.js',
         format: 'iife',
         name: 'poli'
      },
      plugins: [
         // nodeResolve(),
         commonjs()
      ]
   },
   {
      input: 'js/lib.js',
      output: {
         file: 'script/lib.js',
         format: 'cjs',
         exports: null
      },
      plugins: [
         // nodeResolve(),
         // commonjs()
      ]
   }
];
