(function () {
  'use strict';

  function assert$1(callback) {
    if (!callback()) {
      throw new Error(`Assert failed`);
    }
  }


  function* map(xs, func) {
    for (let x of xs) {
      yield func(x);
    }
  }


  function addAll(container, xs) {
    for (let x of xs) {
      container.add(x);
    }
  }


  class MultiMap {
    bags = new Map;

    add(key, val) {
      let bag = this.bags.get(key);

      if (bag === undefined) {
         bag = new Set();
         this.bags.set(key, bag);
      }

      bag.add(val);
    }

    delete(key, val) {
      let bag = this.bags.get(key);

      if (bag === undefined) {
         return false;
      }

      let didDelete = bag.delete(val);

      if (bag.size === 0) {
         this.bags.delete(key);
      }

      return didDelete;
    }

    addToBag(key, vals) {
      let bag = this.bags.get(key);

      if (bag === undefined) {
        bag = new Set(vals);
        this.bags.set(key, bag);
      }
      else {
        addAll(bag, vals);
      }
    }

    deleteBag(key) {
      return this.bags.delete(key);
    }

    *itemsAt(key) {
      if (this.bags.has(key)) {
        yield* this.bags.get(key);
      }
    }

  }

  const rSingleLineComment = `(?://.*?\n)+`;
  const rMultiLineComment = `/\\*.*?\\*/(?<redundant>.+?)?\n`;
  const rIndentedLine = `[ \t]+\\S.*?\n`;
  const rBlankLine = `\\s*?\n`;
  const rZeroLine = `\\S.*?\n`;
  const rShifted = `${rIndentedLine}(?:(?:${rBlankLine})*${rIndentedLine})*`;
  const rCodeTerminatingLine = `[)\\]}\`'"].*?\n`;
  const rCode = (
    `${rZeroLine}` + 
    `(?:(?:${rBlankLine})*${rIndentedLine})*` +
    `(?:(?:${rBlankLine})*${rCodeTerminatingLine})?`
  );


  const reEntry = new RegExp(
    (() => {
      let branches = [
          `(?<space>(?:${rBlankLine})+)`,
          `(?<single_line_comment>${rSingleLineComment})`,
          `(?<multi_line_comment>${rMultiLineComment})`,
          `(?<shifted>${rShifted})`,
          `(?<code>${rCode})`
        ].join('|');

      return `^(?:${branches})`;
    })(),
    'gms'
  );


  function* parseTopLevel(src) {
    reEntry.lastIndex = 0;
    let index = 0;

    for (;;) {
      reEntry.lastIndex = index;

      let mo = reEntry.exec(src);

      if (mo === null) {
        break;
      }

      index = reEntry.lastIndex;

      let type;
      let ignoreReason = null;

      if (mo.groups.space !== undefined) {
        type = 'space';
      }
      else if (mo.groups.single_line_comment !== undefined) {
        type = 'single-line-comment';
      }
      else if (mo.groups.multi_line_comment !== undefined) {
        if (mo.groups.redundant) {
          type = 'ignored';
          ignoreReason = 'bad-multi-comment';
        }
        else {
          type = 'multi-line-comment';
        }
      }
      else if (mo.groups.shifted !== undefined) {
        type = 'ignored';
        ignoreReason = 'shifted';
      }
      else if (mo.groups.code !== undefined) {
        type = 'code';
      }
      else {
        throw new Error(`Module parse internal error`);
      }

      yield {
        type,
        ignoreReason,
        text: mo[0],
        start: mo.index,
        end: mo.index + mo[0].length,
      };
    }

    if (index < src.length) {
      throw new Error(`Remaining unparsed chunk: '${src.slice(index)}'`);
    }
  }

  const Result = {
    unevaluated: {
      isNormal: false,
      access() {
        throw new Error(`Accessed unevaluated computation result`);
      }
    },

    plain(value) {
      return {
        __proto__: protoPlain,
        value: value
      }
    },

    exception(exc) {
      return {
        __proto__: protoException,
        exc: exc
      }
    }
  };


  const protoPlain = {
    isNormal: true,

    access() {
      return this.value;
    }
  };


  const protoException = {
    isNormal: false,

    access() {
      throw this.exc;
    }
  };

  class Definition {
    static stoppedOnBrokenBinding(binding) {
      return {
        __proto__: protoStoppedOnBrokenBinding,
        brokenBinding: binding
      }
    }

    constructor(module, props) {
      this.module = module;

      this.target = props.target;
      this.source = props.source;
      this.evaluatableSource = props.evaluatableSource;
      this.factory = props.factory;
      this.referencedBindings = props.referencedBindings;

      this.usedBindings = new Set;
      this.usedBrokenBinding = null;

      this.result = null;

      for (let ref of this.referencedBindings) {
        ref.referenceBy(this);
      }

      this.setEvaluationResult(Result.unevaluated);
    }

    get position() {
      return this.module.defs.indexOf(this);
    }

    use(binding) {
      this.usedBindings.add(binding);
      binding.useBy(this);

      if (binding.isBroken) {
        this.usedBrokenBinding = binding;
      }
    }

    setEvaluationResult(result) {
      this.result = result;

      if (result.isNormal) {
        this.target.setBy(this, result.value);
      }
      else {
        this.target.setBrokenBy(this);
      }
    }

    makeUnevaluated() {
      if (this.isUnevaluated) {
        return;
      }

      for (let binding of this.usedBindings) {
        binding.unuseBy(this);
      }

      this.usedBindings.clear();
      this.usedBrokenBinding = null;

      this.setEvaluationResult(Result.unevaluated);
      this.module.recordAsUnevaluated(this);
    }

    get isUnevaluated() {
      return this.result === Result.unevaluated;
    }
  }


  const protoStoppedOnBrokenBinding = {
    isNormal: false,

    access() {
      throw new Error(
        `Definition accessed broken binding: '${this.brokenBinding.name}'`
      );
    }
  };

  function ensureAllDefinitionsEvaluated(module) {
    for (let def of module.unevaluatedDefs) {
      evaluate(def);
    }

    module.unevaluatedDefs.length = 0;
  }


  function evaluate(def) {
    let brokenBinding = null;
    let result;

    try {
      result = withNonLocalRefsIntercepted(
        (module, prop) => {
          let binding = module.getBinding(prop);

          def.use(binding);

          if (binding.isBroken || binding.introDef.position > def.position) {
            if (brokenBinding === null) {
              // This means we had already attempted to stop the evaluation but
              // it caught our exception and continued on. This is incorrect
              // behavior that we unfortunately have no means to eschew.
              brokenBinding = binding;
            }

            throw new StopOnBrokenBinding;          
          }
          else {
            return binding.value;
          }
        },
        () => Result.plain(def.factory.call(null, def.module.$))
      );
    }
    catch (e) {
      if (e instanceof StopOnBrokenBinding) {
        result = Definition.stoppedOnBrokenBinding(brokenBinding);
      }
      else {
        result = Result.exception(e);
      }
    }

    def.setEvaluationResult(result);
  }


  const common$ = {
    get v() {
      return this.module.ns;
    }
  };


  function withNonLocalRefsIntercepted(handler, callback) {
    let oldV = Object.getOwnPropertyDescriptor(common$, 'v');

    let module2proxy = new Map;

    Object.defineProperty(common$, 'v', {
      configurable: true,
      get: function () {
        let proxy = module2proxy.get(this.module);

        if (proxy === undefined) {
          proxy = new Proxy(this.module.ns, {
            get: (target, prop, receiver) => {
              return handler(this.module, prop);
            }
          });

          module2proxy.set(this.module, proxy);
        }

        return proxy;
      }
    });

    try {
      return callback();
    }
    finally {
      Object.defineProperty(common$, 'v', oldV);
    }
  }


  class StopOnBrokenBinding extends Error {}

  class LogicError extends Error {}


  let beingComputed = [];


  function compute(cell, func) {
    if (beingComputed.includes(cell)) {
      throw new LogicError("Circular cell dependency detected");
    }

    beingComputed.push(cell);

    try {
      return func.call(null);
    }
    finally {
      beingComputed.pop();
    }
  }


  function computeWrap(cell, func) {
    try {
      return Result.plain(compute(cell, func));
    }
    catch (exc) {
      if (exc instanceof LogicError) {
        throw exc;
      }

      return Result.exception(exc);
    }
  }


  function dependOn(Bcell) {
    if (beingComputed.length === 0) {
      return;
    }

    let Acell = beingComputed.at(-1);

    if (Acell.deps.has(Bcell)) {
      return;
    }

    Acell.deps.add(Bcell);
    Bcell.revdeps.add(Acell);
  }


  function invalidate(cell) {
    let callbacks = [];
    let queue = new Set([cell]);

    function writeDown(res) {
      let {doLater, invalidate} = res ?? {};

      if (doLater) {
        callbacks.push(doLater);
      }

      if (invalidate) {
        addAll(queue, invalidate);
      }
    }

    for (;;) {
      while (queue.size > 0) {
        let [cell] = queue;

        queue.delete(cell);

        if (cell.onInvalidate) {
          writeDown(cell.onInvalidate());
        }
        else {
          addAll(queue, cell.revdeps);
        }
      }

      let callback = callbacks.shift();

      if (callback === undefined) {
        break;
      }

      writeDown(callback());
    }
  }


  function unlinkDeps(cell) {
    for (let dep of cell.deps) {
      unlinkRevdep(dep, cell);
    }

    cell.deps.clear();
  }


  function unlinkRevdep(cell, revdep) {
    if (cell.unlinkRevdep) {
      cell.unlinkRevdep(revdep);
    }
    else {
      cell.revdeps.delete(revdep);
    }
  }


  class Leaf {
    value;
    revdeps = new Set;

    constructor(value) {
      this.value = value;
    }

    get v() {
      dependOn(this);
      return this.value;
    }

    set v(value) {
      invalidate(this);
      this.value = value;
    }
  }


  class VirtualLeaf {
    accessor;
    revdeps = new Set;

    constructor(accessor) {
      this.accessor = accessor;
    }

    get v() {
      dependOn(this);
      return this.accessor.call(null);
    }
  }


  class Computed {
    func;
    value = Result.unevaluated;
    deps = new Set;
    revdeps = new Set;

    constructor(func) {
      this.func = func;
    }

    get v() {
      dependOn(this);

      if (this.isInvalidated) {
        this.value = computeWrap(this, this.func);

        for (let hook of invalidationHooks.itemsAt(this)) {
          if (hook.onComputed) {
            hook.onComputed.call(null);
          }
        }
      }

      return this.value.access();
    }

    get isInvalidated() {
      return this.value === Result.unevaluated;
    }

    onInvalidate() {
      this.value = Result.unevaluated;
      unlinkDeps(this);

      for (let hook of invalidationHooks.itemsAt(this)) {
        if (hook.onInvalidated) {
          hook.onInvalidated.call(null);
        }
      }

      return {invalidate: this.revdeps};
    }

    addHook(hook) {
      invalidationHooks.add(this, hook);

      if (this.isInvalidated && hook.onInvalidated) {
        hook.onInvalidated.call(null);
      }
    }
  }


  let invalidationHooks = new MultiMap;


  // let invalidationSets = new MultiMap;


  // function addToInvalidationSet(cell, set) {
  //   invalidationSets.add(cell, set);

  //   if (cell.isInvalidated) {
  //     set.add(cell);
  //   }
  // }


  class Derived {
    func;
    value = Result.unevaluated;
    deps = new Set;
    revdep = null;

    constructor(func) {
      if (beingComputed.length === 0) {
        throw new Error(
          `Derived computation can only run within some other computation`
        );
      }

      this.func = func;
      this.value = compute(this, this.func);
      this.revdep = beingComputed.at(-1);
    }

    unlinkRevdep(revdep) {
      assert(() => revdep === this.revdep);

      this.revdep = null;
      unlinkDeps(this);
    }

    onInvalidate() {
      return {
        doLater: () => {
          unlinkDeps(this);

          let newValue = compute(this, this.func);

          if (newValue !== this.value) {
            return {invalidate: [this.revdep]};
          }
        }
      }
    }
  }


  function derived(func) {
    let derived = new Derived(func);

    return derived.value;
  }

  class Binding {
    constructor(module, name) {
      this.module = module;
      this.name = name;
      this.defs = new Map;  // def -> Leaf(value-set-by-definition)
      this.defsize = new VirtualLeaf(() => this.defs.size);
      this.refs = new Set;
      this.usages = new Set;

      this.cell = new Computed(() => bindingValue(this));

      this.cell.addHook({
        // onComputed: () => {
        //   dirtyBindings.delete(this);
        // },
        onInvalidated: () => {
          for (let def of this.usages) {
            def.makeUnevaluated();
          }
          // dirtyBindings.add(this);
        }
      });
    }

    recordValueInNamespace() {
      Object.defineProperty(this.module.ns, this.name, {
        configurable: true,
        enumerable: true,
        ...makeBindingValueDescriptor(this)
      });
    }

    get isBroken() {
      return this.cell.v.isBroken;
    }

    get value() {
      return this.cell.v.value;
    }

    get introDef() {
      let [def] = this.defs.keys();
      return def;
    }

    setBrokenBy(def) {
      let cell = cellForDef(this, def);

      cell.v = Binding.Value.broken;
    }

    setBy(def, value) {
      let cell = cellForDef(this, def);

      cell.v = Binding.Value.plain(value);
    }

    referenceBy(def) {
      this.refs.add(def);
    }

    useBy(def) {
      this.usages.add(def);
    }

    unuseBy(def) {
      this.usages.delete(def);
    }


  }


  function cellForDef(binding, def) {
    let cell = binding.defs.get(def);

    if (cell === undefined) {
      cell = new Leaf;
      binding.defs.set(def, cell);
      invalidate(binding.defsize);
    }

    return cell;
  }


  function bindingValue(binding) {
    if (derived(() => binding.defsize.v === 0)) {
      return Binding.Value.undefined;
    }

    if (derived(() => binding.defsize.v > 1)) {
      return Binding.Value.duplicated;
    }

    let [cell] = binding.defs.values();

    return cell.v;
  }


  Binding.Value = {
    undefined: {
      isBroken: true,
    },
    duplicated: {
      isBroken: true,
    },
    broken: {
      isBroken: true,
    },
    plain(value) {
      return {
        isBroken: false,
        value: value
      }
    }
  };


  function makeBindingValueDescriptor(binding) {
    if (binding.isBroken) {
      return {
        get() {
          throw new Error(`Broken binding access: '${binding.name}'`);
        }
      }
    }
    else {
      return {
        value: binding.value,
        writable: false
      }    
    }
  }

  class Module {
    constructor(path) {
      this.path = path;
      this.bindings = new Map;
      this.defs = [];
      this.unevaluatedDefs = [];
      this.ns = Object.create(null);
      // This object is passed as '_$' to all definitions of this module. That's
      // how definitions reference non-local identifiers: 'x' becomes '_$.v.x'.
      this.$ = {
        __proto__: common$,
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

    addDefinition(def) {
      assert$1(() => !def.isEvaluated);

      this.defs.push(def);
      this.recordAsUnevaluated(def);
    }

    recordAsUnevaluated(def) {
      this.unevaluatedDefs.push(def);
    }
  }

  async function loadProject(projName) {
    let resp = await fetch(`/proj/${projName}/`);
    let {rootModule} = await resp.json();

    let module = await loadModule(projName, rootModule);

    for (let binding of module.bindings.values()) {
      binding.recordValueInNamespace();
    }

    // dirtyBindings.clear();

    console.log(module.ns);
    console.log(module);
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

    ensureAllDefinitionsEvaluated(module);

    return module;
  }


  /**
   * Add the given code block `source` to `module`.
   * 
   * @return Definition, throws on errors.
   */
  function addTopLevelCodeBlock(module, source) {
    let body;

    try {
      ({body} = acornLoose.parse(source, {
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

    let def = new Definition(module, {
      target: module.getBinding(decl.id.name),
      source: source,
      evaluatableSource: source.slice(...decl.init.range),
      factory: factory,
      referencedBindings: new Set(map(nlIds, id => module.getBinding(id.name)))
    });

    module.addDefinition(def);
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

  console.time('bootstrap');

  loadProject('poli')
    .then(() => {
      console.log("Project 'poli' loaded");
    })
    .finally(() => {
      console.timeEnd('bootstrap');
    });

})();
//# sourceMappingURL=bootstrap.js.map
