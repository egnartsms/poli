import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';


export default [
  {
    input: 'poli/bootstrap.js',
    output: {
      file: 'gen/bootstrap.js',
      format: 'iife'
    },
    plugins: [
      nodeResolve(),
      commonjs()
    ]
  }
];
