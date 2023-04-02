export {
  loadProject
}

import {parse as parseJsLoosely} from 'acorn-loose';

import {map} from '$/poli/common.js';
import {parseTopLevel} from '$/poli/parse-top-level.js';
import {evaluateNeededDefs} from '$/poli/evaluate.js';
import {Module} from '$/poli/module.js';
import {Definition} from '$/poli/definition.js';


async function loadProject(projName) {
  let resp = await fetch(`/proj/${projName}/`);
  let {rootModule} = await resp.json();

  let module = await loadModule(projName, rootModule);

  return module;
}


async function loadModule(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  let moduleContents = await resp.text();
  let module = new Module(modulePath);

  for (let block of parseTopLevel(moduleContents)) {
    if (block.type !== 'code') {
      continue;
    }

    addTopLevelCodeBlock(module, block.text);
  }

  evaluateNeededDefs(module);

  for (let binding of module.dirtyBindings) {
    binding.recordValueInNamespace();
  }

  module.dirtyBindings.clear();

  console.log(module.ns);

  return module;
}


const EVALUATION_ORDER_INTERVAL = 1 << 14;
const MAX_EVALUATION_ORDER = 1 << 30;


/**
 * Add the given code block `source` to `module`.
 * 
 * @return Definition, throws on errors.
 */
function addTopLevelCodeBlock(module, source) {
  let body;

  try {
    ({body} = parseJsLoosely(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true
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

  let nlIds = nonlocalIdentifiers(decl.init);
  let instrumentedEvaluatableSource = replaceNonlocals(
    source, decl.init.range, map(nlIds, id => id.range)
  );

  let factory;

  try {
    factory = Function('_$', factorySource(instrumentedEvaluatableSource));
  }
  catch (e) {
    throw new Error(`Factory function threw an exc: '${e.toString()}', source is: '${instrumentedEvaluatableSource}'`);
  }

  let evaluationOrder =
    module.defs.length === 0 ? EVALUATION_ORDER_INTERVAL :
      module.defs.at(-1).evaluationOrder.v + EVALUATION_ORDER_INTERVAL;

  new Definition(module, {
    target: module.getBinding(decl.id.name),
    source: source,
    evaluatableSource: source.slice(...decl.init.range),
    factory: factory,
    referencedBindings: new Set(map(nlIds, id => module.getBinding(id.name))),
    evaluationOrder: evaluationOrder
  });
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
