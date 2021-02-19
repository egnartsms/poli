bootstrap
   assert
common
   yreExec
   yreTest
exc
   throwApiError
-----
tokenizeString ::= function (str) {
   return $.tokenizeStream($.makeStream(str));
}
makeStream ::= function (str) {
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
raise ::= function (stm, message) {
   $.throwApiError('code', {
      message: message,
      row: stm.row,
      col: stm.col
   });
}
indSpaces ::= 3
partialIndSpaces ::= 1
isAtEos ::= function (stm) {
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
   if ($.isAtEos(stm)) {
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
isLookingAtBlankLine ::= function (stm) {
   return $.isLookingAt(stm, /[ ]*$/y);
}
sourceSpan ::= function (stm, callback) {
   let row = stm.row;
   let col = stm.col;
   let maxcol = stm.line.length;
   
   callback();
   
   $.assert(stm.row === row || stm.row === row + 1);
   
   return {
      row,
      col,
      span: (stm.row === row ? stm.col : maxcol) - col
   };
}
tokenizeStream ::= function* (stm) {
   while (!$.isAtEos(stm)) {
      yield* $.parseLine(stm);
   }
}
parseLine ::= function* (stm) {
   if ($.isLookingAtBlankLine(stm)) {
      yield {
         token: 'blank',
         ...$.sourceSpan(stm, () => $.nextLine(stm))
      };
      return;
   }

   yield $.parseIndentation(stm);
   
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
   
   yield {
      token: 'nl',
      ...$.sourceSpan(stm, () => $.nextLine(stm))
   };
}
parseIndentation ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   let rem = nspaces % $.indSpaces;

   if (rem === 0) {
      return {
         token: 'indent',
         level: Math.trunc(nspaces / $.indSpaces),
         full: true,
         ...$.sourceSpan(stm, () => $.advanceN(stm, nspaces))
      }
   }
   else if (rem === $.partialIndSpaces) {
      return {
         token: 'indent',
         level: Math.trunc(nspaces / $.indSpaces) + 1,
         full: false,
         ...$.sourceSpan(stm, () => $.advanceN(stm, nspaces))
      }
   }
   else {
      $.raise(stm, `Incorrect indentation`);
   }
}
parseComment ::= function* (stm) {
   let myindent = stm.col;
   let commentIndent = myindent + $.indSpaces;

   $.advanceN(stm, '#;'.length);

   if ($.isAtEol(stm)) {
      $.nextLine(stm);
   }
   else if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      let line = $.isLookingAtBlankLine(stm) ? '' : $.restOfLine(stm);
      yield {
         token: 'comment-line',
         line: line,
         ...$.sourceSpan(stm, () => $.nextLine(stm))
      };
   }
   else {
      $.raise(stm, `Invalid comment`);
   }

   while (!$.isAtEos(stm)) {
      if ($.isLookingAtBlankLine(stm)) {
         yield {
            token: 'comment-line',
            line: '',
            ...$.sourceSpan(stm, () => $.nextLine(stm))
         };
         continue;
      }

      let nspaces = $.numSpacesAhead(stm);
      if (nspaces <= myindent) {
         break;
      }
      if (nspaces < commentIndent) {
         $.raise(stm, `Insufficient indentation for a comment`);
      }

      $.advanceN(stm, commentIndent);

      yield {
         token: 'comment-line',
         line: $.restOfLine(stm),
         ...$.sourceSpan(stm, () => $.nextLine(stm))
      }
   }
}
parseContinuationLine ::= function* (stm) {
   yield {
      token: '\\',
      ...$.sourceSpan(stm, () => $.advanceN(stm, 1))
   };
   
   if ($.isLookingAtBlankLine(stm)) {
      return;
   }

   if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      yield* $.parseNormalLine(stm);
   }
   else {
      $.raise(stm, `Invalid continuation line start`);
   }
}
parseNormalLine ::= function* (stm) {
   let spaceIndex = /\x20*$/.exec(stm.line).index;
   if (spaceIndex < stm.line.length) {
      stm.col = spaceIndex;
      $.raise(stm, `Line ends with trailing spaces`);
   }
   
   let isAfterOpenParen = false;

   while (!$.isAtEol(stm)) {
      if (stm.nextChar === ' ') {
         $.raise(stm, `Excessive whitespace`);
      }

      let match = $.yExec(stm, /:?\(/y);
      if (match) {
         yield {
            token: match[0],
            ...$.sourceSpan(stm, () => $.advanceMatch(stm, match))
         };
         isAfterOpenParen = true;
         continue;
      }

      if (stm.nextChar === ')') {
         if (!isAfterOpenParen) {
            $.raise(stm, `Closing parenthesis preceded by whitespace`);
         }
      }
      else {
         yield $.consumeToken(stm);
      }
      
      while (stm.nextChar === ')') {
         yield {
            token: ')',
            ...$.sourceSpan(stm, () => $.advanceN(stm, 1))
         };
      }
      
      if (stm.nextChar === '(') {
         $.raise(stm, `Missing whitespace before opening parenthesis`);
      }

      if (stm.nextChar === ' ') {
         $.advanceN(stm, 1);
         isAfterOpenParen = false;
      }
   }
}
consumeString ::= function (stm) {
   const re = /"(?:\\(?:x\h\h|u\h\h\h\h|.)|[^\\])*?(?<term>"|$)/y;

   let match = $.yExec(stm, re);

   if (!match.groups.term) {
      $.raise(stm, `Unterminated string literal`);
   }

   return {
      token: 'string',
      string: JSON.parse(match[0]),
      ...$.sourceSpan(stm, () => $.advanceMatch(stm, match))
   };
}
consumeToken ::= function (stm) {
   if (stm.nextChar === '"') {
      return $.consumeString(stm);
   }
   
   let match = $.yExec(stm, /[^ ()"]+/y);
   let word = match[0];

   let invCharMatch = /[^a-zA-Z0-9~!@$%^&*\-_+=?/<>.:|]/.exec(word);
   if (invCharMatch) {
      $.advanceN(stm, invCharMatch.index);
      $.raise(stm, `Invalid character in the middle of the word`);
   }
   
   if (/^[-+]?\.?[0-9]/.test(word)) {
      if ($.numberValue(word) === null) {
         $.raise(stm, `Invalid numeric literal`)
      }
      
      return {
         token: 'number',
         number: word,
         ...$.sourceSpan(stm, () => $.advanceMatch(stm, match))
      };
   }
   else {
      return {
         token: word[word.length - 1] === ':' ? 'keyword' : 'word',
         word: word,
         ...$.sourceSpan(stm, () => $.advanceMatch(stm, match))
      };
   }
}
numberValue ::= function (number) {
   let value;
   
   try {
      value = $.gEval(number);
   }
   catch (e) {
      return null;
   }
   
   if (typeof value === 'number' || typeof value === 'bigint') {
      return value;
   }
   else {
      return null;
   }
}
gEval ::= global.eval
