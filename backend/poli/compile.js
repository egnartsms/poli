import * as Acorn from 'acorn';

import { procedure } from '$/reactive';
import { map } from '$/common/util.js';
import { theModule } from './sample-module.js';
import * as Module from './module.js';


procedure("Compile all entries of the sample module", function () {
   theModule.entries.forEach(entry => {
      let body;

      try {
         ({body} = Acorn.parse(entry.source, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ranges: true
         }));
      }
      catch (exc) {
         entry.syntaxError = exc;
         return;
      }

      if (body.length !== 1) {
         entry.malformed = `More than 1 expression/declaration in a block`;
         return;
      }

      let [item] = body;

      if (item.type !== 'VariableDeclaration') {
         entry.malformed = `Not supported syntax`;
         return;
      }

      if (item.kind !== 'const') {
         entry.malformed = `Not supported entry`;
         return;
      }

      if (item.declarations.length !== 1) {
         entry.malformed = `Not supporting multiple const declarations`;
         return;
      }

      let [decl] = item.declarations;

      if (decl.id.type !== 'Identifier') {
         entry.malformed = `Only support single variable declaration`;
         return;
      }

      entry.target = Module.getBinding(theModule, decl.id.name);

      let nonlocals = nonlocalIdentifiers(decl.init);
      let instrumented = replaceNonlocals(
         entry.source, decl.init.range, map(nonlocals, node => node.range)
      );

      entry.instrumented = instrumented;

      console.log("entry target id:", entry.target.id);
   });
});


function nonlocalIdentifiers(node) {
   function* refs(node) {
      if (node.type === 'Literal')
         ;
      else if (node.type === 'Identifier') {
         if (Object.hasOwn(window, node.name)) {
            // Global identifier, don't yield
         }
         else {
            yield node;
         }
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
function replaceNonlocals(source, [start, end], ranges) {
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


// function compileIntoFactory(code) {
//    try {
//       return Function('_$', factorySource(code));
//    }
//    catch (e) {
//       throw new Error(`Factory function threw an exc: '${e.toString()}', source is: '${code}'`);
//    }
// }


// const factorySource = (source) => `
// "use strict";
// return (${source});
// `;
