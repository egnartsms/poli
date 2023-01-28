export {parseModuleSource};


const rLineComment = `(?://.*?\n)+`;
const rBlockComment = `/\\*.*?\\*/(?<erroneous>.*?)$`;
const rIndentedLine = `[ \t]+\\S.*?\n`;
const rBlankLine = `\\s*?\n`;
const rZeroLine = `\\S.*?\n`;
const rEntryTerminatingLine = `[)\\]}\`'"].*?\n`;
const rEntry = (
  `${rZeroLine}` + 
  `(?:(?:${rBlankLine})*${rIndentedLine})*` +
  `(?:(?:${rBlankLine})*${rEntryTerminatingLine})?`
);
const rShiftedBlock = `${rIndentedLine}(?:(?:${rBlankLine})*${rIndentedLine})*`;


const reEntry = new RegExp(
  (() => {
    let branches = [
        `(?<line_comment>${rLineComment})`,
        `(?<block_comment>${rBlockComment})`,
        `(?<shifted_block>${rShiftedBlock})`,
        `(?<entry>${rEntry})`
      ].join('|');

    return `^(?:${branches})`;
  })(),
  'gms'
);


function parseModuleSource(src) {
  console.time('parse');
  reEntry.lastIndex = 0;

  let mo;

  while ((mo = reEntry.exec(src)) !== null) {
    let type;

    if (mo.groups.line_comment != null) {
      type = 'line_comment';
    }
    else if (mo.groups.block_comment != null) {
      type = 'block_comment';
    }
    else if (mo.groups.shifted_block != null) {
      type = 'shifted_block';
    }
    else if (mo.groups.entry != null) {
      type = 'entry';
    }
    else {
      throw new Error(`Module parse internal error`);
    }

    // console.log(`<${type}>`);
    // console.log(mo.groups.entry);
  }
  console.timeEnd('parse');
}
