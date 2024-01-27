import * as Acorn from 'acorn';

import * as rv from '$/reactive';
import { map } from '$/common/util.js';

import { theModule } from './sample-module.js';
import * as Mdl from './module.js';


rv.procedure("Compile all entries of the sample module", function () {
   theModule.entries.forEach(entry => {
      let body;

      try {
         ({body} = Acorn.parse(entry.source, {
            ecmaVersion: 'latest',
            sourceType: 'module',
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

      entry.target = Mdl.getBinding(theModule, decl.id.name);

      let nonlocalIds = nonlocalIdentifiers(decl.init);

      entry.referencedBindings = new Set(
         map(nonlocalIds, id => Mdl.getBinding(theModule, id.name))
      );
      entry.instrumentedInitSource = instrumentNonlocalReferences(
         entry.source,
         [decl.init.start, decl.init.end],
         map(nonlocalIds, id => [id.start, id.end])
      );

      let factorySource = `"use strict";\nreturn (${entry.instrumentedInitSource});`;

      try {
         entry.initFactory = Function('_$', factorySource);
      }
      catch (exc) {
         entry.initFactoryError = exc;
         // throw new Error(`Factory function threw an exc: '${e.toString()}', source is: '${code}'`);
      }
   });
});


rv.procedure("Collect 'binding.referencedIn'", function () {
   theModule.bindings.forEach(([name, binding]) => {
      binding.referencedIn = new RvSet;
   });

   theModule.entries.forEach(entry => {
      for (let binding of entry.referencedBindings) {
         binding.referencedIn.eAddUnique(entry);
      }
   });
});


/**
 * @return an array of non-local (module-level) identifiers.
 * So far we only support some limited set of expressions, not full JS.
 */
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
      else {
         throw new Error(`Too complex an expression`);
      }
   }

   return Array.from(refs(node));
}


/**
 * Replace non-local identifiers found at `ranges`: ID => _$.v.ID. Do it only in the portion of the
 * `source` from `start` to `end`.
 *
 * @param `idxStart` - the starting index of the evaluatable part of the definition (e.g. var
 *    declaration init expression).
 * @return instrumented source portion, from `start` to `end`.
 */
function instrumentNonlocalReferences(source, [start, end], ranges) {
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
