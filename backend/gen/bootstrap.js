(function () {
  'use strict';

  function* map(xs, func) {
    for (let x of xs) {
      yield func(x);
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

  class Definition {
    constructor(module, props) {
      this.module = module;

      this.target = props.target;
      this.source = props.source;
      this.evaluatableSource = props.evaluatableSource;
      this.factory = props.factory;
      this.referencedBindings = props.referencedBindings;

      this.usedBindings = new Set;
      this.usedBrokenBinding = null;

      this.value = null;
    }

    use(binding) {
      this.usedBindings.add(binding);
      binding.useBy(this);

      if (binding.isBroken) {
        this.usedBrokenBinding = binding;
      }
    }

    setEvaluationResult(value) {
      this.value = value;
      this.target.setBy(this, value);
    }
  }

  const EvaluationResult = {
    unevaluated: {
      isNormal: false
    },

    plain(value) {
      return {
        isNormal: true,
        value: value
      }
    },

    exception(exc) {
      return {
        isNormal: false,
        exc: exc
      }
    },

    stoppedOnBrokenBinding(binding) {
      return {
        isNormal: false,
        brokenBinding: binding
      }
    }
  };

  function ensureAllDefinitionsEvaluated(module) {
    for (let def of module.defs) {
      ensureEvaluated(def);
    }
  }


  function ensureEvaluated(def) {
    if (def.value !== EvaluationResult.unevaluated) {
      return;
    }

    let accessedBrokenBinding = null;
    let result;

    try {
      result = withNonLocalRefsIntercepted(
        (module, prop) => {
          if (accessedBrokenBinding) {
            // This means we had already attempted to stop the evaluation but it
            // caught our exception and continued on. This is incorrect behavior
            // that we unfortunately have no means to enforce.
            throw new StopOnBrokenBinding;
          }

          let binding = module.getBinding(prop);

          def.use(binding);

          if (binding.isBroken) {
            accessedBrokenBinding = binding;

            throw new StopOnBrokenBinding;
          }
          else {
            return binding.access();
          }
        },
        () => EvaluationResult.plain(def.factory.call(null, def.module.$))
      );
    }
    catch (e) {
      if (e instanceof StopOnBrokenBinding) {
        result = EvaluationResult.stoppedOnBrokenBinding(accessedBrokenBinding);
      }
      else {
        result = EvaluationResult.exception(e);
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

  class Binding {
    constructor(module, name) {
      this.module = module;
      this.name = name;
      this.defs = new Map;
      this.refs = new Set;
      this.usages = new Set;

      this.value = {
        kind: 'unevaluated'
      };
    }

    setBy(def, value) {
      this.defs.set(def, value);
    }

    referenceBy(def) {
      this.refs.add(def);
    }

    useBy(def) {
      this.usages.add(def);
    }

    // get value() {
    //   if (this.defs.length === 0) {
    //     return 'unknown';
    //   }

    //   if (this.defs.length > 1) {
    //     return 'duplicate';
    //   }

    //   let [entry] = this.defs;
    // }
  }

  class Module {
    constructor(path) {
      this.path = path;
      this.bindings = new Map;
      this.defs = [];
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
  }

  async function loadProject(projName) {
    let resp = await fetch(`/proj/${projName}/`);
    let {rootModule} = await resp.json();

    await loadModule(projName, rootModule);
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
      ({body} = acorn.parse(source, {
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

    for (let ref of def.referencedBindings) {
      ref.referenceBy(def);
    }

    module.defs.push(def);
    def.setEvaluationResult(EvaluationResult.unevaluated);
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

  loadProject('poli').then(() => {
    console.log("Project 'poli' loaded");
  });

})();
