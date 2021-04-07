const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

module.exports = {
   input: './script/bootstrap.template.js',
   output: {
      file: './script/bootstrap.js',
      format: 'iife',
      name: 'poli'
   },
   plugins: [nodeResolve(), commonjs()]
};