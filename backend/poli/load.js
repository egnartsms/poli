export {
  loadProject
}

import * as acorn from 'acorn';

import {map, call} from '$/poli/common.js';
import {parseTopLevel} from '$/poli/parse-top-level.js';
import {evaluateNeededDefs} from '$/poli/evaluate.js';
import {Module} from '$/poli/module.js';
import {Definition} from '$/poli/definition.js';


async function loadProject(projName) {
  let resp = await fetch(`/proj/${projName}/`);
  
  if (!resp.ok) {
    throw new Error(`Could not load project metadata: '${projName}'`);
  }

  let {rootModule} = await resp.json();

  let module = await loadModule(projName, rootModule);

  return module;
}


const EVALUATION_ORDER_INTERVAL = 1 << 12;
const MAX_EVALUATION_ORDER = 1 << 30;


async function loadModule(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  console.time('root module parse');

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  let moduleContents = await resp.text();
  let module = new Module(projName, modulePath);

  for (let block of parseTopLevel(moduleContents)) {
    addTopLevel(module, block, call(() => {
      let evaluationOrder = 0;

      return () => {
        evaluationOrder += EVALUATION_ORDER_INTERVAL;
        return evaluationOrder;
      };
    }));
  }

  evaluateNeededDefs(module);

  module.flushDirtyBindings();

  console.timeEnd('root module parse');

  console.log(module.ns);

  return module;
}


function addTopLevel(module, block, nextEvaluationOrder) {
  module.topLevelBlocks.push(block);

  if (block.type !== 'code') {
    return;
  }

  let decl = parseDeclaration(block.text);
  let nlIds = nonlocalIdentifiers(decl.init);
  let instrumented = replaceNonlocals(
    block.text,
    map(nlIds, id => [id.start, id.end]),
    [decl.init.start, decl.init.end]
  );
  let factory = compileIntoFactory(instrumented);

  let def = new Definition(module, {
    codeBlock: block,
    target: module.getBinding(decl.id.name),
    factory: factory,
    referencedBindings: new Set(map(nlIds, id => module.getBinding(id.name))),
    evaluationOrder: nextEvaluationOrder()
  });

  module.textToCodeBlock.add(block.text, block);
  module.codeBlockToDef.set(block, def);
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
