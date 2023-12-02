import * as acorn from 'acorn';

import { procedure } from '$/reactive';
import { theModule } from './sample-module.js';


procedure("Try garbage collection", function () {
   if (theModule.textContents.length % 2 === 0) {
      theModule.lenEven = true;
   }
   else {
      theModule.lenOdd = true;
   }
});


procedure("Compile all entries of the sample module", function () {
   theModule.entries.forEach(entry => {
      entry.refBindings = [];
   });
});


function compileCodeBlock(module, block) {
   assert(() => block.type === 'code');

   let decl = parseDeclaration(block.text);
   let nlIds = nonlocalIdentifiers(decl.init);
   let instrumented = replaceNonlocals(
      block.text,
      map(nlIds, id => [id.start, id.end]),
      [decl.init.start, decl.init.end]
   );
   let factory = compileIntoFactory(instrumented);

   return new Definition(module, {
      target: module.getBinding(decl.id.name),
      factory: factory,
      referencedBindings: new Set(map(nlIds, id => module.getBinding(id.name)))
   });
}


function parseDeclaration(source) {
   let body;

   try {
      ({body} = acorn.parse(source, {
         ecmaVersion: 'latest',
         sourceType: 'module',
      }));
   }
   catch (e) {
      throw new Error(`Not handling syntactically incorrect definitions yet`);
   }

   if (body.length !== 1) {
      throw new Error(`Expected exactly 1 expression/declaration in a block`);
   }

   let [item] = body;

   if (item.type !== 'VariableDeclaration') {
      throw new Error(`Not supported TL member: '${item.type}'`);
   }

   if (item.kind !== 'const') {
      throw new Error(`Not supporting anything except 'const' declarations`);
   }

   if (item.declarations.length !== 1) {
      throw new Error(`Not supporting multiple const declarations`);
   }

   let [decl] = item.declarations;

   if (decl.id.type !== 'Identifier') {
      throw new Error(`Only support single variable declaration`);
   }

   return decl;
}


function compileIntoFactory(code) {
   try {
      return Function('_$', factorySource(code));
   }
   catch (e) {
      throw new Error(`Factory function threw an exc: '${e.toString()}', source is: '${code}'`);
   }
}


const factorySource = (source) => `
"use strict";
return (${source});
`;


function nonlocalIdentifiers(node) {
   function* refs(node) {
      if (node.type === 'Literal')
         ;
      else if (node.type === 'Identifier') {
         yield node;
      }
      else if (node.type === 'UnaryExpression') {
         yield* refs(node.argument);
      }
      else if (node.type === 'BinaryExpression') {
         yield* refs(node.left);
         yield* refs(node.right);
      }
   }

   return Array.from(refs(node));
}


/**
 * Replace non-local identifiers found at `ranges` with "_$.v.ID". `idxStart` is
 * the starting index of the evaluatable part of the definition (e.g. var
 * declaration init expression). Return the modified (instrumented) evaluatable
 * string.
 * 
 * TODO: when needed make it a generic replacer
 */
function replaceNonlocals(source, ranges, [start, end]) {
   let idx = start;
   let pieces = [];

   for (let [from, to] of ranges) {
      pieces.push(source.slice(idx, from));
      pieces.push(`_$.v.${source.slice(from, to)}`);
      idx = to;
   }

   pieces.push(source.slice(idx, end));

   return pieces.join('');
}
