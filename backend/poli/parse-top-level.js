export {parseTopLevel};


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

  let mo;
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
    }
  }

  if (index < src.length) {
    throw new Error(`Remaining unparsed chunk: '${src.slice(index)}'`);
  }
}
