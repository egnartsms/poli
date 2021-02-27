bootstrap
   assert
common
   yreExec
   yreTest
-----
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
TokenizerError ::= class extends Error {
   constructor(stm, message) {
      super();
      this.str = stm.str;
      this.row = stm.row;
      this.col = stm.col;
      this.message = message;
   }
}
indSpaces ::= 4
partialIndSpaces ::= 2
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
tokenizeFromNewline ::= function* (str) {
   let stm = $.makeStream(str);

   while (!$.isAtEos(stm)) {
      yield* $.parseLine(stm);
   }
}
tokenizeEntryDefinition ::= function* (src) {
   // 'src' is what immediately follows "::="
   let stm = $.makeStream(src);

   if ($.isAtEol(stm))
      ;
   else if (stm.nextChar === '\x20') {
      $.advanceN(stm, 1);
      yield* $.parseNormalLine(stm);
   }
   else {
      throw new $.TokenizerError(
         stm, `Entry definition starts with neither space nor newline`
      );
   }
   
   yield $.consumeNewline(stm);
   
   while (!$.isAtEos(stm)) {
      yield* $.parseLine(stm);
   }
}
consumeNewline ::= function (stm) {
   let token = {
      token: 'nl',
      row: stm.row,
      col: stm.col,
   };

   $.nextLine(stm);

   return token;
}
consumeBlank ::= function (stm, what) {
   let token = {
      token: 'blank',
      row: stm.row,
      col: stm.col,
   };

   $.nextLine(stm);

   return token;
}
parseLine ::= function* (stm) {
   let token;

   if ($.isLookingAtBlankLine(stm)) {
      yield $.consumeBlank(stm);
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
   
   yield $.consumeNewline(stm);
}
parseIndentation ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   let rem = nspaces % $.indSpaces;
   let token;

   if (rem === 0) {
      token = {
         token: 'indent',
         level: Math.trunc(nspaces / $.indSpaces),
         full: true,
         row: stm.row,
         col: stm.col,
      };
   }
   else if (rem === $.partialIndSpaces) {
      token = {
         token: 'indent',
         level: Math.trunc(nspaces / $.indSpaces) + 1,
         full: false,
         row: stm.row,
         col: stm.col,
      };
   }
   else {
      throw new $.TokenizerError(stm, `Incorrect indentation`);
   }
   
   $.advanceN(stm, nspaces)

   return token;
}
parseComment ::= function* (stm) {
   let myindent = stm.col;
   let commentIndent = myindent + $.indSpaces;
   let token;

   $.advanceN(stm, '#;'.length);

   if ($.isAtEol(stm)) {
      $.nextLine(stm);
   }
   else if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      token = {
         token: 'comment-line',
         line: $.isLookingAtBlankLine(stm) ? '' : $.restOfLine(stm),
         row: stm.row,
         col: stm.col,
      };
      $.nextLine(stm);
      yield token;
   }
   else {
      throw new $.TokenizerError(stm, `Invalid comment`);
   }

   while (!$.isAtEos(stm)) {
      if ($.isLookingAtBlankLine(stm)) {
         token = {
            token: 'comment-line',
            line: '',
            row: stm.row,
            col: stm.col,
         };
         $.nextLine(stm);
         yield token;
         continue;
      }

      let nspaces = $.numSpacesAhead(stm);
      if (nspaces <= myindent) {
         break;
      }
      if (nspaces < commentIndent) {
         throw new $.TokenizerError(stm, `Insufficient indentation for a comment`);
      }
      
      $.advanceN(stm, commentIndent);
      
      token = {
         token: 'comment-line',
         line: $.restOfLine(stm),
         row: stm.row,
         col: stm.col,
      };
      $.nextLine(stm);
      yield token;
   }
}
parseContinuationLine ::= function* (stm) {
   let token = {
      token: '\\',
      row: stm.row,
      col: stm.col,
   };
   $.advanceN(stm, 1);
   yield token;
   
   if ($.isLookingAtBlankLine(stm)) {
      return;
   }

   if (stm.nextChar === ' ') {
      $.advanceN(stm, 1);
      yield* $.parseNormalLine(stm);
   }
   else {
      throw new $.TokenizerError(stm, `Invalid continuation line start`);
   }
}
parseNormalLine ::= function* (stm) {
   let spaceIndex = /\x20*$/.exec(stm.line).index;
   if (spaceIndex < stm.line.length) {
      stm.col = spaceIndex;
      throw new $.TokenizerError(stm, `Line ends with trailing spaces`);
   }
   
   let isAfterOpenParen = false;
   let token;

   while (!$.isAtEol(stm)) {
      if (stm.nextChar === ' ') {
         throw new $.TokenizerError(stm, `Excessive whitespace`);
      }

      let match = $.yExec(stm, /:?\(/y);
      if (match) {
         token = {
            token: match[0],
            row: stm.row,
            col: stm.col,
         };
         $.advanceMatch(stm, match);
         yield token;

         isAfterOpenParen = true;
         continue;
      }

      if (stm.nextChar === ')') {
         if (!isAfterOpenParen) {
            throw new $.TokenizerError(
               stm, `Closing parenthesis preceded by whitespace`
            );
         }
      }
      else {
         yield $.consumeToken(stm);
      }
      
      while (stm.nextChar === ')') {
         token = {
            token: ')',
            row: stm.row,
            col: stm.col,
         };
         $.advanceN(stm, 1);
         yield token;
      }
      
      if (stm.nextChar === '(') {
         throw new $.TokenizerError(
            stm, `Missing whitespace before opening parenthesis`
         );
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
      throw new $.TokenizerError(stm, `Unterminated string literal`);
   }

   let token = {
      token: 'string',
      string: JSON.parse(match[0]),
      row: stm.row,
      col: stm.col,
   };
   $.advanceMatch(stm, match);
   return token;
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
      throw new $.TokenizerError(stm, `Invalid character in the middle of the word`);
   }
   
   let token;
   
   if (/^[-+]?\.?[0-9]/.test(word)) {
      if ($.numberValue(word) === null) {
         throw new $.TokenizerError(stm, `Invalid numeric literal`)
      }
      
      token = {
         token: 'number',
         number: word,
         row: stm.row,
         col: stm.col,
      };
   }
   else {
      token = {
         token: word[word.length - 1] === ':' ? 'keyword' : 'word',
         word: word,
         row: stm.row,
         col: stm.col,
      };
   }
   
   $.advanceMatch(stm, match)
   
   return token;
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
