// import {runToFixpoint, action, declareReactiveAttrs} from '$/reactive';


export async function loadModuleContents(projName, modulePath) {
  let resp = await fetch(`/proj/${projName}/${modulePath}`);

  if (!resp.ok) {
    throw new Error(`Could not load module contents: '${modulePath}'`);
  }

  let contents = await resp.text();

  // entity.input = /\/\*(.*?)\/\*/.exec(contents)[1];

  // runToFixpoint();

  // console.log("Entity:", entity);

  return contents;
}


// let module = null;
//
// rule("Parse raw module contents into a list of top-level blocks", () => {
//   module.topLevelBlocks = parseModuleBody(module.contents);
// });


// rule("Make module definitions", () => {
//   let text2def = new MostlySingleMap;

//   module.definitions = new RvSet;

//   subnode(() => {
//     // analyze module.topLevelBlocks, try to re-use definitions
//     // ...
//     // ...

//     module.definitions.reload(newDefs);
//   });
// });
