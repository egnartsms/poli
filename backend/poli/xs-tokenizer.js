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
assert ::= $_.require('assert').strict
indSpaces ::= 3
partialIndSpaces ::= 1
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
tokenizeStream ::= function* (stm) {
   while (!$.isAtEos(stm)) {
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
      throw new Error(`Incorrect indentation of ${nspaces} spaces`);
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
      $.nextLine(stm);
      yield {
         token: 'comment-line',
         line: line
      };
   }
   else {
      throw new Error(`Invalid comment`);
   }

   while (!$.isAtEos(stm)) {
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
   }
   else {
      throw new Error(`Invalid continuation line start`);
   }
}
parseNormalLine ::= function* (stm) {
   if (stm.line[stm.line.length - 1] === ' ') {
      throw new Error(`Line ends with trailing spaces`);
   }

   let isAfterOpenParen = false;

   while (!$.isAtEol(stm)) {
      if (stm.nextChar === ' ') {
         throw new Error(`Excessive whitespace`);
      }

      let match = $.yExec(stm, /:?\(/y);
      if (match) {
         $.advanceMatch(stm, match);
         yield {
            token: match[0]
         };
         isAfterOpenParen = true;
         continue;
      }

      if (stm.nextChar === ')') {
         if (!isAfterOpenParen) {
            throw new Error(`Closing parenthesis preceded by whitespace`);
         }
      }
      else {
         yield $.consumeToken(stm);
      }
      
      while (stm.nextChar === ')') {
         $.advanceN(stm, 1);
         yield {
            token: ')'
         };
      }
      
      if (stm.nextChar === '(') {
         throw new Error(`Missing whitespace before opening parenthesis`);
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
      throw new Error(`Unterminated string literal`);
   }

   $.advanceMatch(stm, match);

   return {
      token: 'string',
      string: JSON.parse(match[0])
   };
}
consumeToken ::= function (stm) {
   if (stm.nextChar === '"') {
      return $.consumeString(stm);
   }
   
   let match = $.yExec(stm, /[^ ()"]+/y);
   let word = match[0];

   if (/[^a-zA-Z0-9~!@$%^&*\-_+=?/<>.:]/.test(word)) {
      throw new Error(`Invalid character in the middle of the word`);
   }

   $.advanceMatch(stm, match);
   
   if (/^[-+]?\.?[0-9]/.test(word)) {
      if ($.numberValue(word) === null) {
         throw new Error(`Invalid numeric literal: ${word}`);
      }

      return {
         token: 'number',
         number: word
      }
   }

   if (word[word.length - 1] === ':') {
      return {
         token: 'keyword',
         word: word
      }
   }

   return {
      token: 'word',
      word: word
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
