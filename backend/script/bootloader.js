(function () {
   'use strict';

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

   function publicDescriptor(descriptor) {
      return {
         enumerable: true,
         configurable: true,
         ...descriptor
      }
   }


   function publicGetterDescriptor(fn) {
      return {
         enumerable: true,
         configurable: true,
         get: fn
      }
   }


   function publicReadonlyPropertyDescriptor(value) {
      return {
         enumerable: true,
         configurable: true,
         writable: false,
         value: value
      }
   }


   function wrapWith(tag, value) {
      return {
         [tag]: value
      }
   }


   function isWrappedWith(tag, value) {
      return value != null && Object.hasOwn(value, tag)
   }

   let invq = new Queue;
   let blockedCells = new Map;   // cell -> blockedBy

   // a ComputedCell that's currently being computed
   let beingComputed = null;


   function plainCell() {
      return function cell() {
         connectCells(beingComputed, cell);

         return cell.value;
      }
   }


   function rigidCell(initialValue) {
      let cell = plainCell();

      Object.assign(cell, rigidCellProps);
      cell.value = initialValue;
      cell.revdeps = new Set;

      return cell;
   }


   let rigidCellProps = {
      invalidate() {
         for (let rdep of this.revdeps) {
            rdep.invalidate();
         }
      },

      set(value) {
         this.value = value;
         this.invalidate();
      },

      mutate(fnmut) {
         fnmut(this.value);
         this.invalidate();
      }
   };


   function rigidGetter(getter) {
      let cell = plainCell();

      setCellGetter(cell, getter);
      cell.revdeps = new Set;

      return cell;
   }


   function computableCell(computer) {
      let cell = plainCell();

      setCellInvalid(cell);
      cell.invalidate = invalidateThisCell;
      cell.computer = computer;
      cell.deps = new Set;
      cell.revdeps = new Set;

      invq.enqueue(cell);

      return cell;
   }


   function invalidateThisCell() {
      setCellInvalid(this);
      invq.enqueue(this);

      if (blockedCells.has(this)) {
         // When a blocked cell becomes a plain invalid cell, we don't transitively follow
         // its 'revdeps' because the cell's observable state is not changed.
         blockedCells.delete(this);
      }
      else {
         for (let rdep of this.revdeps) {
            rdep.invalidate();
         }
      }

      disconnectFromDeps(this);   
   }


   function setCellValue(cell, value) {
      Object.defineProperty(cell, 'value', publicReadonlyPropertyDescriptor(value));
   }


   function setCellGetter(cell, func) {
      Object.defineProperty(cell, 'value', publicGetterDescriptor(func));
   }


   function setCellInvalid(cell) {
      setCellGetter(cell, invalidValueGetter);
   }


   function invalidValueGetter() {
      throw new InvalidCell(this)
   }


   class InvalidCell extends Error {
      constructor(cell) {
         super();
         this.cell = cell;
      }
   }


   function connectCells(cell, dependency) {
      cell.deps.add(dependency);
      dependency.revdeps.add(cell);
   }


   function disconnectFromDeps(comp) {
      for (let dep of comp.deps) {
         dep.revdeps.delete(comp);
      }

      comp.deps.clear();
   }


   function digest() {
      let ncycles = 0;

      while (!invq.isEmpty) {
         ncycles += 1;

         let cell = invq.dequeue();
         
         let value = null;
         let exc = null;
         let blockedBy = null;

         beingComputed = cell;

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

         if (blockedBy !== null) {
            blockedCells.set(cell, blockedBy);
            continue;
         }
         
         // So 'cell' is going to be made valid now. But some blocked cells may be depending on 'cell'
         // at this point. As 'cell' becomes now valid all these blocked cells should be invalidated.
         for (let rdep of cell.revdeps) {
            rdep.invalidate();
         }

         if (exc !== null) {
            setCellGetter(cell, () => { throw exc });
         }
         else if (isWrappedWith(getterTag, value)) {
            setCellGetter(cell, value[getterTag]);
         }
         else {
            setCellValue(cell, value);
         }
      }

      console.log("Digest cycles:", ncycles);

      // At this point, the invalid queue is exhausted. All the cells we have in
      // blockedCells are blocked because of circular dependencies.
      for (let cell of blockedCells.keys()) {
         let chain = [cell];
         let xcell = cell;

         for (;;) {
            xcell = blockedCells.get(xcell);
            let k = chain.indexOf(xcell);

            chain.push(xcell);

            if (k !== -1) {
               break;
            }
         }

         setCellGetter(cell, circularGetter(chain));
      }

      blockedCells.clear();
   }


   const getterTag = Symbol('getter');


   function getter(func) {
      return wrapWith(getterTag, func);
   }


   class CircularDependency extends Error {
      constructor(circle) {
         super("Circular dependency");
         this.circle = circle;
      }
   }


   function circularGetter(circle) {
      return () => {
         throw new CircularDependency(circle);
      }
   }

   class Binding {
      constructor(module, name) {
         this.module = module;
         this.name = name;
         this.inputs = rigidCell([]);
         this.state = computableCell(() => computeState(this));
         this.value = computableCell(() => computeValue(this));
      }

      defineAsTarget(def) {
         this.inputs.mutate(arr => arr.push({def}));
      }

      defineAsImport(donorBinding) {
         // TODO: continue here
         this.inputs.mutate(arr => arr.push({donorBinding}));
      }

      defineAsAsterisk(donorModule) {
         this.inputs.mutate(arr => arr.push({donorModule}));
      }

      runtimeValueDescriptor() {
         let state = this.state.value;

         if (state.isOk && Object.hasOwn(state, 'runtimeValue')) {
            return {
               writable: false,
               value: state.runtimeValue
            }
         }
         else {
            // TODO: we cannot have it read-only because our dynamic module members wouldn't work. When
            // we have full generalized 'target-definition' schema, the read-onliness should be
            // explicitly managed. By default, we should have writable: false, and only where needed
            // should it be made writable.
            let desc = Object.getOwnPropertyDescriptor(this.value, 'value');
            if (Object.hasOwn(desc, 'writable')) {
               desc.writable = true;
            }
            return desc;
         }
      }
   }


   function computeState(binding) {
      if (binding.inputs().length === 0) {
         return {
            isOk: false,
            reason: 'undefined'
         };
      }

      if (binding.inputs().length > 1) {
         return {
            isOk: false,
            reason: 'duplicate'
         };
      }

      let [input] = binding.inputs();

      if (Object.hasOwn(input, 'def')) {
         let {def} = input;

         return {
            isOk: true,
            source: def
         }
      }
      else if (Object.hasOwn(input, 'donorBinding')) {
         let {donorBinding} = input;

         if (donorBinding.state().isOk) {
            return {
               isOk: true,
               source: donorBinding.value
            }
         }
         else {
            return {
               isOk: false,
               reason: 'import-of-broken',
            }
         }
      }
      else if (Object.hasOwn(input, 'donorModule')) {
         let {donorModule} = input;

         if (donorModule.exists()) {
            return {
               isOk: true,
               source: () => donorModule.nsProxy,
               runtimeValue: donorModule.ns
            }
         }
         else {
            return {
               isOk: false,
               reason: 'import-of-broken'
            }
         }
      }
      else
         throw new Error(`Logic error`);
   }


   function computeValue(binding) {
      if (binding.state().isOk) {
         let {source} = binding.state();

         return source();
      }
      else {
         let {reason} = binding.state();

         if (reason === 'undefined') {
            return getter(() => {
               throw new Error(`Referenced undefined binding '$.${binding.name}'`);
            });
         }
         else if (reason === 'duplicate') {
            return getter(() => {
               throw new Error(`Referenced duplicated binding '$.${binding.name}'`);
            });
         }
         else if (reason === 'import-of-broken') {
            return getter(() => {
               throw new Error(`Referenced broken or non-existing import '$.${binding.name}'`);
            })
         }
         else
            throw new Error(`Logic error`);
      }
   }

   class Module {
      constructor(name) {
         this.name = name;
         this.exists = rigidCell(false);
         this.bindings = new Map;
         this.setters$ = [];
         this.ns = {__proto__: null};
         this.nsProxy = new Proxy(this.ns, {
            get: (target, prop, receiver) => this.getBinding(prop).value()
         });
      }

      youExist() {
         this.exists.set(true);
      }

      getBinding(name) {
         let binding = this.bindings.get(name);

         if (binding === undefined) {
            binding = new Binding(this, name);
            this.bindings.set(name, binding);
         }

         return binding;
      }

      addEntry(entryInfo) {
         let {target, kind, definition} = entryInfo;

         if (!Object.hasOwn(kind2js, kind)) {
            throw new Error(`Unknown entry definition kind: '${kind}'`);
         }

         let targetBinding = this.getBinding(target);
         let factory, set$;

         try {
            let source = factorySource(kind2js[kind](definition));
            [factory, set$] = Function(source)();
         }
         catch (e) {
            console.error(`Failed to compile: ${this.name}.${target}`);
            targetBinding.defineAsTarget(rigidGetter(() => { throw e }));
            return;
         }

         set$(this.nsProxy);
         this.setters$.push(set$);

         targetBinding.defineAsTarget(computableCell(factory));
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
            Object.defineProperty(
               this.ns, binding.name, publicDescriptor(binding.runtimeValueDescriptor())
            );
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


   const kind2js = {
      js: (def) => def,
      thunk: (def) => `function () {\n   ${def}\n}`,
      body: (def) => `(function () {\n   ${def}\n})()`,
   };

   class Registry {
      constructor() {
         this.modules = new Map;
         this.nExisting = 0;
      }

      getModule(name, {create} = {create: false}) {
         let module = this.modules.get(name);

         if (module === undefined) {
            module = new Module(name);
            this.modules.set(name, module);

            if (create) {
               module.youExist();
               this.nExisting += 1;
            }
         }
         // The module may be already mentioned before but not yet created.
         else if (create && !module.exists.value) {
            module.youExist();
            this.nExisting += 1;
         }

         return module;
      }

      loadModuleData(mdata) {
         let module = this.getModule(mdata.name, {create: true});

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
         for (let entryInfo of mdata.body) {
            module.addEntry(entryInfo);
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
   const reImportBlock = /^(?=\S)(?<donor>.+)\n(?<lines>(?:(?!\S).*\n?)*)/gm;


   function parseModuleImports(str) {
      let res = [];

      for (let match of str.matchAll(reImportBlock)) {
         let {donor, lines: rawImports} = match.groups;

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


   const reDocstring = `\x20{3}:.*\\n(?:(?:\x20*\\n)*\x20{4,}\\S.*\\n)*`;
   const reDef = `(?:(?:\x20*\\n)*\x20.*\\n)*`;
   const reBody = `(?<docstring>${reDocstring})?(?<def>${reDef})`;

   const reEntry = new RegExp(
      `^(?<target>\\S.*?)\x20+:(?<kind>.+?)?:=(?:\x20*\\n(?<multiliner>${reBody})|\x20+(?<oneliner>.+)\\n)`,
      'gm'
   );


   function parseModuleBody(str) {
      let entries = Array.from(str.matchAll(reEntry), match => {
         return {
            target: match.groups.target,
            definition: match.groups.oneliner ?? match.groups.def,
            kind: match.groups.kind ?? 'js'
         }
      });

      return entries;
   }

   // const loadModules = require('./load-modules');


   function run(rawModules) {
      console.time('bootload');
      let modulesData = Array.from(rawModules, parseRawModule);
      let namespaces = loadModulesData(modulesData);
      console.timeEnd('bootload');

      // Tests
      {
         namespaces.get('test-dedb')['runTests']();
      }

      return;
   }


   run(/*RAW_MODULES*/);

}());
