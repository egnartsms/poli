'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const SRC_FOLDER = 'poli';
const RUN_MODULE = 'runner';

const fs = require('fs');


/**
 * Read plain textual contents of all Poli modules.
 * 
 * @return [{type, lang, name, contents}]
 * */
function readRawModules() {
   let modules = [];

   for (let filename of fs.readdirSync(SRC_FOLDER)) {
      let res = parseModuleFilename(filename);
      if (res === null) {
         continue;
      }

      modules.push({
         type: 'module',
         lang: res.lang,
         name: res.name,
         contents: fs.readFileSync(`./${SRC_FOLDER}/${filename}`, 'utf8')
      });
   }

   return modules;
}


function parseModuleFilename(filename) {
   let mtch = /^(?<name>.+)\.(?<lang>js)$/.exec(filename);
   if (!mtch) {
      return null;
   }

   return {
      name: mtch.groups.name,
      lang: mtch.groups.lang,
   };
}

/**
 * @param raw: {type, lang, name, contents}
 * @return: {
 *    name,
 *    lang,
 *    imports: [{donor, imports: [{name, alias}]}],
 *    body: [{target, definition}]
 * }
 */
function parseRawModule(raw) {
   let imports, body;

   try {
      ({imports, body} = parseModuleContents(raw.contents));
   }
   catch (e) {
      console.error(`Could not parse module '${raw.name}'`);
      throw e;
   }

   return {
      name: raw.name,
      lang: raw.lang,
      imports: imports,
      body: body
   }
}


function parseModuleContents(str) {
   let mtch = str.match(/^-+\n/m);
   if (!mtch) {
      throw new Error(`Bad module: not found the ----- separator`);
   }

   let rawImports = str.slice(0, mtch.index);
   let rawBody = str.slice(mtch.index + mtch[0].length);

   let imports = parseModuleImports(rawImports);
   let body = parseModuleBody(rawBody);

   return {imports, body};
}


const reModuleName = /^[\w-]+$/;
const reImportLine = /^(?<entry>\S+?)(?:\s+as:\s+(?<alias>\S+?))?$/;  // it's trimmed


function parseModuleImports(str) {
   let res = [];

   for (let [[,donor], rawImports] of headerSplit(str, /^(?=\S)(.+?)\n/gm)) {
      if (!reModuleName.test(donor)) {
         throw new Error(`Bad module name to import: '${donor}'`);
      }

      let imports = [];

      for (let line of rawImports.split(/\n/)) {
         line = line.trim();

         if (line === '') {
            continue;
         }

         let mtch = reImportLine.exec(line);

         if (mtch === null) {
            throw new Error(`Invalid import line: '${line}'`);
         }

         imports.push({
            name: mtch.groups.entry === '*' ? null : mtch.groups.entry,
            alias: mtch.groups.alias ?? null
         });
      }

      res.push({
         donor,
         imports
      });
   }

   return res;
}


const reDocstring = ` {3}:.*\\n(?:(?: *\\n)* {4,}\\S.*\\n)*`;
const reDef = `(?:(?: *\\n)* .*\\n)*`;
const reBody = `(?<docstring>${reDocstring})?(?<def>${reDef})`;

const reEntry = new RegExp(
   `^(?<target>\\S.*?) +::=(?: *\\n(?<body>${reBody})| +(?<oneliner>.+)\\n)`,
   'gm'
);


function parseModuleBody(str) {
   let entries = [];

   for (let [mtch, interspace] of headerSplit(str, reEntry)) {
      if (mtch === null) {
         // Leading interspace is skipped
         continue;
      }
      
      entries.push({
         target: mtch.groups.target,
         definition: mtch.groups.oneliner ?? mtch.groups.def
      });
   }

   return entries;
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      ... HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.

   Yield pairs [header_match, body]. For the first header, if something precedes it, we
   yield [null, body0].
*/
function* headerSplit(str, reHeader) {
   let prev_i = 0, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (mtch.index > 0) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }

      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}

class Queue {
   constructor() {
      this.front = [];
      this.rear = [];
   }

   enqueue(item) {
      this.rear.push(item);
   }

   enqueueFirst(item) {
      this.front.push(item);
   }

   dequeue() {
      if (this.front.length === 0) {
         rearToFront(this);
      }

      return this.front.pop();
   }

   get isEmpty() {
      return this.front.length === 0 && this.rear.length === 0;
   }
}


function rearToFront(queue) {
   while (queue.rear.length > 0) {
      queue.front.push(queue.rear.pop());
   }
}

let invq = new Queue;
let blockedCells = new Map;   // cell -> blockedBy
// either a Cell or Stage object that's currently being computed
let beingComputed = null;


function rigidCell(value) {
   let cell = () => {
      connectCells(beingComputed, cell);

      return cell.val;
   };

   cell.val = value;
   cell.revdeps = new Set;

   Object.assign(cell, rigidCellProps);

   return cell;
}


const rigidCellProps = {
   setValue(value) {
      this.val = value;
      this.invalidate();
   },

   invalidate() {
      for (let rdep of this.revdeps) {
         rdep.invalidate();
      }
   },

   mutate(callback) {
      callback(this.val);
      this.invalidate();
   }
};


rigidCell.exc = function (exc) {
   let cell = () => {
      connectCells(beingComputed, cell);

      throw cell.exc;
   };

   cell.exc = exc;
   cell.revdeps = new Set;

   return cell;
};


function computableCell(computer) {
   let cell = () => {
      connectCells(beingComputed, cell);

      return cell.val.get(cell);
   };

   cell.invalidate = invalidateCell;
   cell.val = invalidValue;
   cell.stage = null;
   cell.computer = computer;
   cell.revdeps = new Set;
   cell.deps = new Set;

   invq.enqueue(cell);

   return cell;
}


function invalidateCell() {
   invalidateCellValue(this);

   if (this.stage !== null) {
      killStage(this.stage);
      this.stage = null;
   }

   disconnectFromDeps(this);   
}


class Stage {
   constructor(cell, prev, computer) {
      this.cell = cell;
      this.prev = prev;
      this.next = null;
      this.computer = computer;
      this.deps = new Set;
   }

   invalidate() {
      invalidateCellValue(this.cell);

      if (this.next !== null) {
         killStage(this.next);

         this.next = null;
         this.cell.stage = this;
      }

      disconnectFromDeps(this);
   }
}


function killStage(stage) {
   if (stage.next !== null) {
      killStage(stage.next);
   }

   stage.prev = null;
   stage.next = null;

   disconnectFromDeps(stage);
}


function invalidateCellValue(cell) {
   if (!cell.val.isValid) {
      return;
   }

   cell.val = invalidValue;
   invq.enqueue(cell);

   if (blockedCells.has(cell)) {
      // When a blocked invalid cell becomes a plain invalid cell, we don't transitively
      // follow its 'revdeps' because the cell's actual state is not changed.
      blockedCells.delete(cell);
   }
   else {
      for (let rdep of cell.revdeps) {
         rdep.invalidate();
      }
   }
}


function disconnectFromDeps(comp) {
   for (let dep of comp.deps) {
      dep.revdeps.delete(comp);
   }

   comp.deps.clear();
}


function connectCells(cell, dependency) {
   cell.deps.add(dependency);
   dependency.revdeps.add(cell);
}


function digest() {
   let ncycles = 0;

   while (!invq.isEmpty) {
      ncycles += 1;

      let cell = invq.dequeue();
      
      let value = null;
      let exc = null;
      let blockedBy = null;

      beingComputed = cell.stage ?? cell;

      try {
         value = beingComputed.computer.call(null);
      }
      catch (e) {
         if (e instanceof InvalidCell) {
            blockedBy = e.cell;
         }
         else {
            exc = e;
         }
      }
      finally {
         beingComputed = null;
      }

      // The following 2 cases do not make 'cell' valid.
      if (blockedBy !== null) {
         blockedCells.set(cell, blockedBy);
         cell.val = blockedValue;
         continue;
      }
      
      if (value instanceof Restart) {
         appendNewStage(cell, value.computer);
         invq.enqueueFirst(cell);
         continue;
      }

      // So 'cell' is going to be made valid now. But a blocked cell may depend on(at most
      // 1) invalidated cell. When the latter becomes valid, those blocked cells should
      // be made invalidated again.
      for (let rdep of cell.revdeps) {
         rdep.invalidate();
      }

      if (exc !== null) {
         cell.val = exceptionValue(exc);
      }
      else if (value instanceof Getter) {
         cell.val = getterValue(value.getter);
      }
      else {
         cell.val = plainValue(value);
      }
   }

   console.log("Digest cycles:", ncycles);

   // At this point, the invalid queue is exhausted. All the cells we have in
   // blockedCells are blocked because of circular dependencies.
   while (blockedCells.size > 0) {
      let {value: [cell, ncell]} = blockedCells[Symbol.iterator]().next();
      let chain = [cell];
      let k = -1;

      for (;;) {
         k = chain.indexOf(ncell);

         if (k !== -1) {
            break;
         }

         chain.push(ncell);
         [cell, ncell] = [ncell, blockedCells.get(ncell)];
      }

      for (let i = 0; i < chain.length; i += 1) {
         chain[i].val = circularValue(dependencyCircle(chain, k, i));
      }

      for (let cell of chain) {
         blockedCells.delete(cell);
      }
   }
}


function appendNewStage(cell, computer) {
   let newStage = new Stage(cell, cell.stage, computer);

   if (cell.stage !== null) {
      cell.stage.next = newStage;
      newStage.prev = cell.stage;
   }

   cell.stage = newStage;
}


function dependencyCircle(chain, k, i) {
   return [
      ...chain.slice(i, k),
      ...chain.slice(Math.max(i, k)),
      ...chain.slice(k, i)
   ];
}


const invalidValue = {
   isValid: false,
   get(cell) {
      throw new InvalidCell(cell);
   }
};


const blockedValue = {
   // blocked cell is considered valid for the purpose of invalidation algorithm, but it
   // throws InvalidCell in exactly the same way as an ordinary invalidated cell.
   isValid: true,
   get(cell) {
      throw new InvalidCell(cell);
   }
};


const protoExceptionValue = {
   isValid: true,
   get(cell) {
      throw this.exc;
   },
   descriptor() {
      return {
         get: () => {
            throw this.exc;
         }
      }
   }
};


function exceptionValue(exc) {
   return {
      __proto__: protoExceptionValue,
      exc
   }
}


const protoPlainValue = {
   isValid: true,
   get(cell) {
      return this.value;
   },
   descriptor() {
      return {
         value: this.value,
         writable: true
      }
   }
};


function plainValue(value) {
   return {
      __proto__: protoPlainValue,
      value
   }
}


function getterValue(getter) {
   return {
      isValid: true,
      get(cell) {
         return getter();
      },
      descriptor() {
         return {
            get: getter
         }
      }
   }
}


const protoCircularValue = {
   isValid: true,
   get(cell) {
      throw new CircularDependency(this.circle);
   },
   descriptor() {
      let circle = this.circle;

      return {
         get() {
            throw new CircularDependency(circle);
         }
      }
   }
};


function circularValue(circle) {
   return {
      __proto__: protoCircularValue,
      circle
   }
}


class InvalidCell extends Error {
   constructor(cell) {
      super();
      this.cell = cell;
   }
}


class CircularDependency extends Error {
   constructor(circle) {
      super();
      this.circle = circle;
   }
}


class Getter {
   constructor(func) {
      this.getter = func;
   }
}


function getter(func) {
   return new Getter(func);
}


class Restart {
   constructor(func) {
      this.computer = func;
   }
}

class Binding {
   constructor(module, name) {
      this.module = module;
      this.name = name;
      this.inputs = rigidCell([]);
      this.state = computableCell(this.computeState.bind(this));
      this.value = computableCell(this.computeValue.bind(this));
   }

   defineAsTarget(def) {
      this.inputs.mutate(arr => arr.push({def}));
   }

   defineAsImport(donorBinding) {
      this.inputs.mutate(arr => arr.push({donorBinding}));
   }

   defineAsAsterisk(donorModule) {
      this.inputs.mutate(arr => arr.push({donorModule}));
   }

   computeState() {
      if (this.inputs().length === 0) {
         return {
            isDefined: false,
            reason: 'undefined'
         };
      }

      if (this.inputs().length > 1) {
         return {
            isDefined: false,
            reason: 'duplicate'
         };
      }

      let [input] = this.inputs();

      if (input.hasOwnProperty('def')) {
         let {def} = input;

         return {
            isDefined: true,
            source: def
         }
      }
      else if (input.hasOwnProperty('donorBinding')) {
         let {donorBinding} = input;

         if (donorBinding.state().isDefined) {
            return {
               isDefined: true,
               source: donorBinding.value
            }
         }
         else {
            return {
               isDefined: false,
               reason: 'import-of-broken',
            }
         }
      }
      else if (input.hasOwnProperty('donorModule')) {
         let {donorModule} = input;

         return {
            isDefined: true,
            source: () => donorModule.ns
         }
      }
      else
         throw new Error(`Logic error`);
   }

   computeValue() {
      if (this.state().isDefined) {
         let {source} = this.state();

         return source();
      }
      else {
         let {reason} = this.state();

         if (reason === 'undefined') {
            return getter(() => {
               throw new Error(`Referenced undefined binding '$.${this.name}'`);
            });
         }
         else if (reason === 'duplicate') {
            return getter(() => {
               throw new Error(`Referenced duplicated binding '$.${this.name}'`);
            });
         }
         else if (reason === 'import-of-broken') {
            return getter(() => {
               throw new Error(`Referenced broken import '$.${this.name}'`);
            })
         }
         else
            throw new Error(`Logic error`);
      }
   }
}

class Module {
   constructor(name) {
      this.name = name;
      this.exist = false;
      this.bindings = new Map;
      this.setters$ = [];
      this.ns = Object.create(null);
   }

   youExist() {
      this.exist = true;
   }

   getBinding(name) {
      let binding = this.bindings.get(name);

      if (binding === undefined) {
         binding = new Binding(this, name);
         this.bindings.set(name, binding);
      }

      return binding;
   }

   addEntry(target, source) {
      let factory, set$;

      try {
         [factory, set$] = Function(factorySource(source))();
      }
      catch (e) {
         console.error(source);
         targetBinding.defineAsTarget(rigidCell.exc(e));
         return;
      }

      set$(new Proxy(this.ns, {
         get: (target, prop, receiver) => this.getBinding(prop).value()
      }));

      let cell = computableCell(factory);
      let targetBinding = this.getBinding(target);

      targetBinding.defineAsTarget(cell);

      this.setters$.push(set$);
   }

   addImport(donorBinding, importUnder) {
      let targetBinding = this.getBinding(importUnder);

      targetBinding.defineAsImport(donorBinding);
   }

   addAsterisk(donor, alias) {
      let targetBinding = this.getBinding(alias);

      targetBinding.defineAsAsterisk(donor);
   }

   switchToRuntime() {
      for (let binding of this.bindings.values()) {
         Object.defineProperty(this.ns, binding.name, {
            configurable: true,
            enumerable: true,
            ...binding.value.val.descriptor()
         });
      }

      for (let set$ of this.setters$) {
         set$(this.ns);
      }
   }
}


// params are: $ns, $proxy
const factorySource = (source) => `
   "use strict";
   let $;

   return [
      () => (${source}),
      (new$) => { $ = new$ }
   ]
`;

class Registry {
   constructor() {
      this.modules = new Map;
      this.nExisting = 0;
   }

   getModule(name, {exists} = {exists: false}) {
      let module = this.modules.get(name);

      if (module === undefined) {
         module = new Module(name);
         this.modules.set(name, module);

         if (exists) {
            module.youExist();
            this.nExisting += 1;
         }
      }

      return module;
   }

   loadModuleData(mdata) {
      let module = this.getModule(mdata.name, {exists: true});

      // Imports
      for (let {donor, imports} of mdata.imports) {
         let donorM = this.getModule(donor);

         for (let {name, alias} of imports) {
            if (name === null) {
               module.addAsterisk(donorM, alias);
            }
            else {
               module.addImport(donorM.getBinding(name), alias ?? name);
            }
         }
      }

      // Definitions
      for (let {target, definition} of mdata.body) {
         module.addEntry(target, definition);
      }
   }

   switchToRuntime() {
      for (let module of this.modules.values()) {
         module.switchToRuntime();
      }
   }

   moduleNsMap() {
      return new Map(
         Array.from(this.modules.values(), module => [module.name, module.ns])
      );
   }
}

/**
 * @param modulesData: [{
 *    name,
 *    lang,
 *    imports: [{donor, imports: [{name, alias}]}],
 *    body: [{target, definition}]
 * }]
 * return: Map { module name -> namespace object }
 */
function loadModulesData(modulesData) {
   let reg = new Registry();

   for (let mdata of modulesData) {
      reg.loadModuleData(mdata);
   }

   digest();

   reg.switchToRuntime();
   return reg.moduleNsMap();
}


// const reIdentifier = /^([a-z][a-z0-9_$]*)$/i;

exports.RUN_MODULE = RUN_MODULE;
exports.SRC_FOLDER = SRC_FOLDER;
exports.loadModulesData = loadModulesData;
exports.parseRawModule = parseRawModule;
exports.readRawModules = readRawModules;
