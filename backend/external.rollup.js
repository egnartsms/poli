import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';


export default [
  {
    input: 'poli/external.js',
    output: {
      file: 'gen/external.js',
      format: 'iife'
    },
    plugins: [
      nodeResolve(),
      commonjs()
    ]
  }
];
