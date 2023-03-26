export {npmExports};


import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';


async function npmExports({baseDir='.', urlPrefix}) {
  baseDir = path.join(baseDir, 'node_modules');

  try {
    await fsP.access(baseDir);
  }
  catch (e) {
    throw new Error(`Not found the node_modules folder`);
  }

  let importmap = {};

  let topLevelFolders = await fsP.readdir(baseDir, {withFileTypes: true});

  for (let folder of topLevelFolders) {
    if (!folder.isDirectory()) {
      continue;
    }

    if (folder.name.startsWith('@')) {
      // TODO: handle @-namespaces
      continue;
    }

    let pkg = await loadPackageJson(path.join(baseDir, folder.name));

    if (!pkg?.['exports']) {
      continue;
    }

    for (let [src, dst] of exportsEntries(pkg['exports'])) {
      if (!isExpectedAsteriskUsage(src) || !isExpectedAsteriskUsage(dst)) {
        console.error(`'${folder.name}': unexpected '*' usage in "exports"`);
        continue;
      }

      if (src.endsWith('/*')) {
        if (!dst.endsWith('/*')) {
          console.error(`'${folder.name}': /* used inconsistently`);
          continue;
        }

        src = src.slice(0, -1);
        dst = dst.slice(0, -1);
      }

      importmap[path.join(folder.name, src)] =
        path.join('/', urlPrefix, folder.name, dst);
    }
  }

  return importmap;
}


async function loadPackageJson(folder) {
  try {
    return JSON.parse(
      await fsP.readFile(path.join(folder, 'package.json'), 'utf-8')
    );
  }
  catch (e) {
    return null;
  }
}


function* exportsEntries(exports) {
  // 'exports' may itself be a leaf entry (with no subpaths)
  let target = exportEntryTarget(exports);

  if (target !== null) {
    yield [".", target];
    return;
  }

  for (let key in exports) {
    let target = exportEntryTarget(exports[key]);

    if (target !== null) {
      yield [key, target];
    }
  }
}


const ACCEPTABLE_CONDITIONS = ['browser', 'development', 'import', 'default'];
const ESM_CONDITIONS = ['browser', 'import'];


function exportEntryTarget(entry) {
  if (typeof entry === 'string') {
    return null;
  }

  if (Array.isArray(entry)) {
    for (let item of entry) {
      let result = exportEntryTarget(item);

      if (result !== null) {
        return result;
      }
    }

    return null;
  }

  let isEsm = false;

  outer:
  while (typeof entry !== 'string') {
    for (let cond of ACCEPTABLE_CONDITIONS) {
      if (Object.hasOwn(entry, cond)) {
        entry = entry[cond];
        isEsm ||= ESM_CONDITIONS.includes(cond);
        continue outer;
      }
    }

    return null;
  }

  return isEsm ? entry : null;
}


function isExpectedAsteriskUsage(path) {
  let i = path.indexOf('*');

  return i === -1 || i === path.length - 1 && path.at(-2) === '/';
}
