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
   }
   else {
      throw new Error(`Invalid continuation line start`);
   }
}
consumeToken ::= function (stm) {
   const re = /(?<str>".*?(?<!\\)")|(?<unstr>".*$)|(?<word>[^ ()"]+)/y;

   let match = $.yExec(stm, re);
   if (!match) {
      throw new Error(`Logic error`);
   }

   if (match.groups.unstr) {
      throw new Error(`Unterminated string literal`);
   }

   if (match.groups.str) {
      $.advanceMatch(stm, match);

      return {
         token: 'string',
         string: JSON.parse(match[0])
      };
   }
   
   if (match.groups.word) {
      if (/[^a-zA-Z0-9~!@$%^&*\-_+=?/<>.:]/.test(match.groups.word)) {
         throw new Error(`Invalid character in the middle of the word`);
      }

      $.advanceMatch(stm, match);

      return {
         token: 'word',
         word: match.groups.word
      };
   }
   
   throw new Error(`Logic error`);
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
tokenize ::= function (str) {
   return Array.from($.parseStream($.makeParseStream(str)));
}
