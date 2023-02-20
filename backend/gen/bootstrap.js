(function () {
  'use strict';

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

    let mo;

    while ((mo = reEntry.exec(src)) !== null) {
      let type;

      if (mo.groups.single_line_comment !== undefined) {
        type = 'single_line_comment';
      }
      else if (mo.groups.multi_line_comment !== undefined) {
        type = mo.groups.redundant ? 'ignored' : 'multi_line_comment';
      }
      else if (mo.groups.shifted != null) {
        type = 'ignored';
      }
      else if (mo.groups.code != null) {
        type = 'code';
      }
      else {
        throw new Error(`Module parse internal error`);
      }

      yield {
        type: type,
        text: mo[0],
        start: mo.index,
        end: mo.index + mo[0].length,
      };
    }

    if (reEntry.lastIndex < src.length) {
      yield {
        type: 'ignored',
        text: src.slice(reEntry.lastIndex),
        start: reEntry.lastIndex,
        end: src.length
      };
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

    for (let block of parseTopLevel(moduleContents)) {

      if (block.type === 'code') {
        let {body} = esprima.parseModule(block.text);

        if (body.length !== 1) {
          throw new Error(`Expected exactly 1 expression/declaration in a block`);
        }

        let [moduleItem] = body;

        switch (moduleItem.type) {
        case 'ImportDeclaration':
          throw new Error(`Not supporting imports yet`);

        case 'FunctionDeclaration':
          throw new Error(`Not supporting function declarations yet`);

        case 'VariableDeclaration':
          break;

        default:
          throw new Error(`Not supported TL member: '${moduleItem.type}'`);
        }
      }
    }

    return {

    }
  }

  loadProject('poli');

})();
