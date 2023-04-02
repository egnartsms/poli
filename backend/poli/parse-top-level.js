export {parseTopLevel};


import {isAllSpaces} from '$/poli/common.js';


const rSingleLineComment = `(?://.*?\n)+`;
const rMultiLineComment = `/\\*.*?\\*/(?<redundant>.*?)\n`;
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
  let lastIndex;

  reEntry.lastIndex = 0;

  for (;;) {
    lastIndex = reEntry.lastIndex;

    let mo = reEntry.exec(src);

    if (mo === null) {
      break;
    }

    let type;
    let ignoreReason = null;

    if (mo.groups.space !== undefined) {
      type = 'space';
    }
    else if (mo.groups.single_line_comment !== undefined) {
      type = 'single-line-comment';
    }
    else if (mo.groups.multi_line_comment !== undefined) {
      if (isAllSpaces(mo.groups.redundant)) {
        type = 'multi-line-comment';
      }
      else {
        type = 'ignored';
        ignoreReason = 'bad-multi-comment';        
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
    }
  }

  if (lastIndex < src.length) {
    throw new Error(`Remaining unparsed chunk: '${src.slice(lastIndex)}'`);
  }
}
