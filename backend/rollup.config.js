
// const nodeResolve = require('rollup-plugin-node-resolve');
// const commonjs = require('rollup-plugin-commonjs');
// import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [
   {
      input: 'js/bootloader.js',
      output: {
         file: 'script/bootloader.js',
         format: 'iife',
         name: 'poli'
      },
      plugins: [
         // nodeResolve(),
         commonjs()
      ]
   },
   {
      input: 'js/node-lib.js',
      output: {
         file: 'script/node-lib.js',
         format: 'cjs',
         exports: null
      },
      plugins: [
         // nodeResolve(),
         // commonjs()
      ]
   }
];
