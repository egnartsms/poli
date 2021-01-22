-----
assert ::= $_.require('assert').strict
indlvl ::= 3
subindlvl ::= 1
yreExec ::= function (re, offset, str) {
   $.assert(re.sticky);
   re.lastIndex = offset;
   return re.exec(str);
}
yreTest ::= function (re, offset, str) {
   $.assert(re.sticky);
   re.lastIndex = offset;
   return re.test(str);
}
makeParseStream ::= function (str) {
   let stm = {
      str,
      rowOff: -1,
      nextRowOff: 0,
      line: '',
      row: -1,
      col: -1,
      get nextChar() {
         return this.line[this.col];
      }
   };
   $.nextLine(stm);
   return stm;
}
isStreamDone ::= function (stm) {
   return stm.line === null;
}
isAtEol ::= function (stm) {
   return stm.col === stm.line.length;
}
yExec ::= function (stm, re) {
   return $.yreExec(re, stm.col, stm.line);
}
isLookingAt ::= function (stm, re) {
   return $.yreTest(re, stm.col, stm.line);
}
nextLine ::= function (stm) {
   if ($.isStreamDone(stm)) {
      return;
   }
   if (stm.nextRowOff >= stm.str.length) {
      stm.line = null;
      stm.rowOff = stm.str.length;
      return;
   }

   let match = $.yreExec(/.*/y, stm.nextRowOff, stm.str);

   stm.rowOff = stm.nextRowOff;
   stm.nextRowOff = stm.rowOff + match[0].length + 1;  // \n itself
   stm.line = match[0];
   stm.row += 1;
   stm.col = 0;
}
restOfLine ::= function (stm) {
   return stm.line.slice(stm.col);
}
numSpacesAhead ::= function (stm) {
   return $.yExec(stm, /[ ]*/y)[0].length;
}
advanceN ::= function (stm, n) {
   $.assert(n <= stm.line.length - stm.col);
   stm.col += n;
}
advanceMatch ::= function (stm, match) {
   $.advanceN(stm, match[0].length);
}
skipSpaces ::= function (stm) {
   while (!$.isAtEol(stm) && stm.nextChar === ' ') {
      stm.col += 1;
   }
}
isLookingAtBlankLine ::= function (stm) {
   return $.isLookingAt(stm, /[ ]*$/y);
}
parseStream ::= function* (stm) {
   while (!$.isStreamDone(stm)) {
      yield* $.parseLine(stm);
   }
}
parseLine ::= function* (stm) {
   if ($.isLookingAtBlankLine(stm)) {
      $.nextLine(stm);
      yield {
         token: 'blank'
      };
      return;
   }

   yield {
      token: 'indent',
      ...$.parseIndentation(stm)
   };
   
   if ($.isLookingAt(stm, /#;/y)) {
      yield* $.parseComment(stm);
      return;
   }
   
   if (stm.nextChar === '\\') {
      yield* $.parseContinuationLine(stm);
   }
   else {
      yield* $.parseNormalLine(stm);
   }
   
   $.nextLine(stm);
   yield {
      token: 'nl'
   };
}
parseIndentation ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   let rem = nspaces % $.indlvl;

   if (rem === 0) {
      $.advanceN(stm, nspaces);
      return {
         level: Math.trunc(nspaces / $.indlvl),
         full: true
      }
   }
   else if (rem === $.subindlvl) {
      $.advanceN(stm, nspaces);
      return {
         level: Math.trunc(nspaces / $.indlvl) + 1,
         full: false
      }
   }
   else {
      throw new Error(`Incorrect indentation of ${nspaces} spaces`);
   }
}
parseComment ::= function* (stm) {
   let myindent = stm.col;
   let commentIndent = myindent + $.indlvl;

   $.advanceN(stm, '#;'.length);

   if ($.isAtEol(stm)) {
      $.nextLine(stm);
   }
   else if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      let line = $.isLookingAtBlankLine(stm) ? '' : $.restOfLine(stm);
      $.nextLine(stm);
      yield {
         token: 'comment-line',
         line: line
      };
   }
   else {
      throw new Error(`Invalid comment`);
   }

   while (!$.isStreamDone(stm)) {
      if ($.isLookingAtBlankLine(stm)) {
         $.nextLine(stm);
         yield {
            token: 'comment-line',
            line: ''
         };
         continue;
      }

      let nspaces = $.numSpacesAhead(stm);
      if (nspaces <= myindent) {
         break;
      }
      if (nspaces < commentIndent) {
         throw new Error(`Insufficient indentation for a comment`);
      }

      $.advanceN(stm, commentIndent);

      let line = $.restOfLine(stm);
      $.nextLine(stm);
      yield {
         token: 'comment-line',
         line: line
      };
   }
}
parseContinuationLine ::= function* (stm) {
   $.advanceN(stm, 1);
   yield {
      token: '\\'
   };
   
   if ($.isLookingAtBlankLine(stm)) {
      return;
   }

   if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      yield* $.parseNormalLine(stm);
      return;
   }
   
   throw new Error(`Invalid continuation line`);
}
reToken ::= (function () {
   let typemap = {
      string: /"(?:\\?.)*?"/,
      special: /:\(|\(|\)/,
      word: /[a-zA-Z0-9~!@$%^&*-_+=?/<>.:]+/
   };

   let parts = [];

   for (let [type, re] of Object.entries(typemap)) {
      parts.push(`(?<${type}>${re.source})`);
   }

   return new RegExp(parts.join('|'), 'y');
})()
parseNormalLine ::= function* (stm) {
   let trailingSpaces = /[ ]*$/.exec(stm.line)[0].length;
   let limitCol = stm.line.length - trailingSpaces;

   let nextGen = $.extractWord(stm);

   while (stm.col < limitCol) {
      nextGen = yield* nextGen;
   }
}
extractWord ::= function* (stm, rightAfterOpeningParen=false) {
   if (stm.nextChar === ' ') {
      throw new Error(`Excessive whitespace`);
   }

   let match = $.yExec(stm, $.reToken);
   if (!match) {
      throw new Error(`Invalid character`);
   }
   
   $.advanceMatch(stm, match);
   
   if (match.groups.special != null) {
      if (match.groups.special === ')' && !rightAfterOpeningParen) {
         throw new Error(`Unexpected closing parenthesis`);
      }

      yield {
         token: match.groups.special
      };
      
      return (
         match.groups.special === ')' ? $.extractSpace(stm) : $.extractWord(stm, true)
      );
   }
   
   if (match.groups.word != null) {
      yield {
         token: 'word',
         word: match.groups.word
      };
      return $.extractSpace(stm);
   }
   
   if (match.groups.string != null) {
      yield {
         token: 'string',
         string: JSON.parse(match.groups.string)
      };
      return $.extractSpace(stm);
   }
   
   throw new Error(`Logic error`);
}
extractSpace ::= function* (stm) {
   if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      return $.extractWord(stm);
   }
   
   if (stm.nextChar === ')') {
      $.advanceN(stm, 1);
      yield {
         token: ')'
      };
      return $.extractSpace(stm);
   }
   
   throw new Error(`Invalid character`);
}
tokenize ::= function (str) {
   return Array.from($.parseStream($.makeParseStream(str)));
}
