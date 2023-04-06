export {
  Module, proto$
}


import {assert, deleteAll} from '$/poli/common.js';
import {MostlySingleMap} from '$/poli/mostly-single-map.js';
import {Binding} from './binding.js';

/**
 * Common prototype of all the '_$' module-specific objects.
 * 
 * This trick is used to easily intercept access of non-local
 * (module-level) identifiers in all the modules of the system. Those '_$'
 * objects for each module are expected to have the 'module' property that
 * points back to respective Module instance. In each module, the 'name'
 * references to non-local variables become '_$.v.name'.
 */
const proto$ = {
  get v() {
    return this.module.ns;
  }
};


class Module {
  constructor(projName, path) {
    this.projName = projName;
    this.path = path;
    this.bindings = new Map;
    this.dirtyBindings = new Set;
    this.topLevelBlocks = [];
    this.textToCodeBlock = new MostlySingleMap;
    this.codeBlockToDef = new Map;
    this.defs = new Set;
    this.unevaluatedDefs = new Set;
    this.ns = Object.create(null);
    // This object is passed as '_$' to all definitions of this module.
    this.$ = {
      __proto__: proto$,
      module: this
    };
  }

  getBinding(name) {
    let binding = this.bindings.get(name);

    if (binding === undefined) {
      binding = new Binding(this, name);
      this.bindings.set(name, binding);
    }

    return binding;
  }

  flushDirtyBindings() {
    for (let binding of this.dirtyBindings) {
      binding.flush();
    }
  }

  clearBlocks() {
    this.topLevelBlocks = [];
    this.textToCodeBlock = new MostlySingleMap;
    this.codeBlockToDef = new Map;
  }

  appendBlock(block) {
    this.topLevelBlocks.push(block);

    if (block.type === 'code') {
      this.textToCodeBlock.add(block.text, block);
    }
  }

  attachDefToBlock(def, block) {
    assert(() => def.module === this);
    assert(() => block.type === 'code');

    def.codeBlock = block;
    this.codeBlockToDef.set(block, def);
  }

  removeDeadDefinitions() {
    let defs = new Set(this.defs);

    deleteAll(defs, this.codeBlockToDef.values());

    for (let def of defs) {
      def.unlink();
    }
  }
}
