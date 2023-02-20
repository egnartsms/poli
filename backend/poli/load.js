export {
  loadProject
}


import {parseTopLevel} from '$/poli/parse.js';


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
  let blocks = [];

  for (let block of parseTopLevel(moduleContents)) {
    blocks.push(block);

    if (block.type === 'code') {
      let {body} = esprima.parseModule(block.text);

      if (body.length !== 1) {
        throw new Error(`Expected exactly 1 expression/declaration in a block`);
      }

      let [moduleItem] = body;

      switch (moduleItem.type) {
      case 'ImportDeclaration':
        throw new Error(`Not supporting imports yet`);
        break;

      case 'FunctionDeclaration':
        throw new Error(`Not supporting function declarations yet`);
        break;

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


function load() {
  let module = rawModules.find(({name}) => name === 'dedb-join-plan');
  parseTopLevel(module.contents);
  return;
}
