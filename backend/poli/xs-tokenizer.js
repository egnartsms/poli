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
withSource ::= function (stm, callback) {
   let row = stm.row;
   let col = stm.col;
   let maxcol = stm.line.length;
   
   let token = callback();
   
   $.assert(stm.row === row || stm.row === row + 1);
   
   token.row = row;
   token.col = col;
   token.span = (stm.row === row ? stm.col : maxcol) - col;
   
   return token;
}
tokenizeStream ::= function* (stm) {
   while (!$.isAtEos(stm)) {
      for (let callback of $.parseLine(stm)) {
         yield $.withSource(stm, callback);
      }
   }
}
parseLine ::= function* (stm) {
   if ($.isLookingAtBlankLine(stm)) {
      yield () => {
         $.nextLine(stm);
         return {
            token: 'blank'
         }
      };
      return;
   }

   yield () => ({
      token: 'indent',
      ...$.parseIndentation(stm)
   });
   
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
   
   yield () => {
      $.nextLine(stm);
      return {
         token: 'nl'
      };
   };
}
parseIndentation ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   let rem = nspaces % $.indSpaces;

   if (rem === 0) {
      $.advanceN(stm, nspaces);
      return {
         level: Math.trunc(nspaces / $.indSpaces),
         full: true
      }
   }
   else if (rem === $.partialIndSpaces) {
      $.advanceN(stm, nspaces);
      return {
         level: Math.trunc(nspaces / $.indSpaces) + 1,
         full: false
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
      yield () => {
         $.nextLine(stm);
         return {
            token: 'comment-line',
            line: line
         }
      };
   }
   else {
      $.raise(stm, `Invalid comment`);
   }

   while (!$.isAtEos(stm)) {
      if ($.isLookingAtBlankLine(stm)) {
         yield () => {
            $.nextLine(stm);
            return {
               token: 'comment-line',
               line: ''
            };
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

      let line = $.restOfLine(stm);
      yield () => {
         $.nextLine(stm);
         return {
            token: 'comment-line',
            line: line
         };
      };
   }
}
parseContinuationLine ::= function* (stm) {
   yield () => {
      $.advanceN(stm, 1);
      return {
         token: '\\'
      }
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
         yield () => {
            $.advanceMatch(stm, match);
            return {
               token: match[0]
            };
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
         yield* $.consumeToken(stm);
      }
      
      while (stm.nextChar === ')') {
         yield () => {
            $.advanceN(stm, 1);
            return {
               token: ')'
            };
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
consumeString ::= function* (stm) {
   const re = /"(?:\\(?:x\h\h|u\h\h\h\h|.)|[^\\])*?(?<term>"|$)/y;

   let match = $.yExec(stm, re);

   if (!match.groups.term) {
      $.raise(stm, `Unterminated string literal`);
   }

   yield () => {
      $.advanceMatch(stm, match);
      return {
         token: 'string',
         string: JSON.parse(match[0])
      };
   };
}
consumeToken ::= function* (stm) {
   if (stm.nextChar === '"') {
      yield* $.consumeString(stm);
      return;
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
      
      yield () => {
         $.advanceMatch(stm, match);
         return {
            token: 'number',
            number: word
         };
      };
      return;
   }
   
   yield () => {
      $.advanceMatch(stm, match);
      return {
         token: word[word.length - 1] === ':' ? 'keyword' : 'word',
         word: word
      }
   };
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
