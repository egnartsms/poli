export {
  loadProject, refreshModule
}

import {map, call} from '$/poli/common.js';
import {parseTopLevel} from '$/poli/parse-top-level.js';
import {evaluateNeededDefs} from '$/poli/evaluate.js';
import {Module} from '$/poli/module.js';
import {Definition, EvaluationOrder} from '$/poli/definition.js';
import {compileCodeBlock} from '$/poli/compile.js';


async function loadProject(projName) {
  let resp = await fetch(`/proj/${projName}/`);
  let {rootModule} = await resp.json();

  return await loadModule(projName, rootModule);
}


async function loadModule(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  console.time('root module parse');

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  let contents = await resp.text();
  let module = new Module(projName, modulePath);

  reconciliateModuleContents(module, contents);

  console.timeEnd('root module parse');

  console.log(module.ns);

  return module;
}


async function refreshModule(module) {
  let resp = await fetch(`/proj/${module.projName}/${module.path}`);
  let contents = await resp.text();

  reconciliateModuleContents(module, contents);
  console.log(module.ns);
}


function reconciliateModuleContents(module, newContents) {
  let {textToCodeBlock, codeBlockToDef} = module;

  module.clearBlocks();

  let orderer = new Orderer;

  for (let block of parseTopLevel(newContents)) {
    module.appendBlock(block);

    if (block.type !== 'code') {
      continue;
    }

    // Try to re-use an old definition
    let def;
    let exBlock = textToCodeBlock.popAt(block.text);

    if (exBlock) {
      def = codeBlockToDef.get(exBlock);
      // TODO: flesh out whether and when this case is really possible.
      if (!def) {
        continue;
      }
    }
    else {
      def = compileCodeBlock(module, block);
    }

    module.attachDefToBlock(def, block);
    orderer.push(def);
  }

  orderer.end();
  module.removeDeadDefinitions();

  evaluateNeededDefs(module);
  module.flushDirtyBindings();
}


class Orderer {
  pending = [];
  lower = EvaluationOrder.INFIMUM;  // last established evaluation order

  get isLowBound() {
    return this.lower > EvaluationOrder.INFIMUM;
  }

  push(def) {
    if (def.evaluationOrder.v < this.lower) {
      this.pending.push(def);
      return;
    }

    if (this.pending.length === 0) {
      this.lower = def.evaluationOrder.v;
      return;
    }

    if (this.isLowBound) {
      reassignBetween(this.pending, this.lower, def.evaluationOrder.v);
    }
    else {
      reassignDown(this.pending, def.evaluationOrder.v);
    }

    this.lower = def.evaluationOrder.v;
    this.pending.length = 0;
  }

  end() {
    if (this.pending.length === 0) {
      return;
    }

    if (this.isLowBound) {
      reassignUp(this.pending, this.lower);
    }
    else {
      reassignAfresh(this.pending);
    }

    this.pending.length = 0;
    this.lower = EvaluationOrder.INFIMUM;
  }
}


function reassignDown(defs, upper) {
  let evOrder = upper;

  for (let i = defs.length; i > 0;) {
    i -= 1;
    evOrder *= EvaluationOrder.MULT_DOWN;

    defs[i].evaluationOrder.v = evOrder;
  }
}


function reassignBetween(defs, lower, upper) {
  let dd = (upper - lower) / (defs.length + 1);
  let evOrder = lower;

  for (let def of defs) {
    evOrder += dd;
    def.evaluationOrder.v = evOrder;
  }
}


function reassignUp(defs, lower) {
  let evOrder = lower;

  for (let def of defs) {
    evOrder *= EvaluationOrder.MULT_UP;
    def.evaluationOrder.v = evOrder;
  }  
}


function reassignAfresh(defs) {
  reassignUp(defs, EvaluationOrder.NORMAL_START * EvaluationOrder.MULT_DOWN);
}
