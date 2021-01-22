-----
assert ::= $_.require('assert').strict
indlvl ::= 3
subindlvl ::= 2
makeStream ::= function (str) {
   return {
      str,
      pos: 0,
      row: 0,
      col: 0,
   }
}
exec ::= function (stream, re) {
   $.assert(re.sticky);
   re.lastIndex = stream.pos;
   return re.exec(stream.str);
}
isStreamDone ::= function (stm) {
   return stm.pos === stm.str.length;
}
streamNext ::= function (stm) {
   return stm.str[stm.pos];
}
advanceWithinLine ::= function (stm, n) {
   n = Math.min(n, stm.str.length - stm.pos);
   stm.pos += n;
   stm.col += n;
}
advanceMatch ::= function (stm, match) {
   $.advanceWithinLine(stm, match[0].length);
}
advance1 ::= function (stm) {
   if ($.streamNext(stm) === '\n') {
      stm.pos += 1;
      stm.row += 1;
      stm.col = 0;
   }
   else {
      $.advanceWithinLine(stm, 1);
   }
}
advanceMatchToEol ::= function (stm, match) {
   $.advanceMatch(stm, match);
   $.advance1(stm);
}
numSpacesAhead ::= function (stm) {
   let match = $.exec(stm, /[ ]*/y);
   return match[0].length;
}
consumeSpaces ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   $.advanceWithinLine(stm, nspaces);
   return nspaces;
}
consumeIndentation ::= function (stm) {
   let nspaces = $.numSpacesAhead(stm);
   let rem = nspaces % $.indlvl;

   $.advanceWithinLine(stm, nspaces);

   if (rem === 0) {
      return {
         level: Math.trunc(nspaces / $.indlvl),
         sub: false
      }
   }
   else if (rem === $.subindlvl) {
      return {
         level: Math.trunc(nspaces / $.indlvl) + 1,
         sub: true
      }
   }
   else {
      throw new Error(`Incorrect indentation of ${indent} spaces`);
   }
}
consumeBlankLine ::= function (stm) {
   let match = $.exec(stm, /[ ]*$/my);

   if (match) {
      $.advanceMatchToEol(stm, match);
   }
   
   return !!match;
}
consumeToEol ::= function (stm) {
   let match = $.exec(stm, /.*/y);
   $.advanceMatchToEol(stm, match);
   return match[0];
}
parseFromNewline ::= function* (stm) {
   if ($.isStreamDone(stm)) {
      yield {
         token: 'end'
      };
      return;
   }

   // let indent = $.consumeIndentation(stm);
   yield {
      token: 'indent',
      ...$.consumeIndentation(stm)
   };

   if ($.isStreamDone(stm)) {
      yield {
         token: 'end'
      };
   }
   else if ($.streamNext(stm) === '\n') {
      $.advance1(stm);

      yield {
         token: 'nl'
      };
      yield* $.parseFromNewline(stm);
   }
   else if ($.streamNext(stm) === ';') {
      yield* $.parseComment(stm);
   }
   else {
      yield* $.parseLine(stm);
   }
}
parseComment ::= function* (stm) {
   let match = $.exec(stm, /;;(?= |$)/my);
   if (!match) {
      throw new Error(`Incorrect comment`);
   }

   let myindent = stm.col;
   let commentIndent = myindent + $.indlvl;

   $.advanceMatch(stm, match);
   if ($.streamNext(stm) === ' ') {
      $.advanceWithinLine(stm, 1);
   }

   yield {
      token: 'comment-line',
      line: $.consumeBlankLine(stm) ? '\n' : $.consumeToEol(stm)
   };

   while (!$.isStreamDone(stm)) {
      if ($.consumeBlankLine(stm)) {
         yield {
            token: 'comment-line',
            line: '\n'
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

      $.advanceWithinLine(stm, commentIndent);
      yield {
         token: 'comment-line',
         line: $.consumeToEol(stm)
      };
   }
   
   yield* $.parseFromNewline(stm);
}
parseLine ::= function* (stm) {
   
}
text1 ::= `
   ;;  
      i don't really ; know
      what this is all about
`.slice(1)
test ::= function () {
   // return Array.from($.parseFromNewline($.makeStream($.text1)));
}
savePrev ::= function (stream) {
   stream.prev = {
      pos: stream.pos,
      line: stream.line,
      col: stream.col
   }
}
unconsume ::= function (stream) {
   $.assert(stream.prev !== null);
   stream.pos = stream.prev.pos;
   stream.line = stream.prev.line;
   stream.col = stream.prev.col;
   stream.prev = null;
}
lookingAt ::= function (stream, re) {
   $.assert(re.sticky);
   re.lastIndex = stream.pos;
   return re.test(stream.str);
}
consumeCommentStart ::= function (stream) {
   if ($.streamNext(stream) !== ';') {
      return false;
   }
   
   let match = $.exec(stream, /;;(?= |\n)/y);
   if (!match) {
      throw new Error(`Invalid comment`);
   }
   
   $.savePrev(stream);
   stream.pos += match[0].length;
   stream.col += match[0].length;
   
   return true;
}
readFromNewline ::= function (stream, myindent) {
   if ($.consumeBlankLine(stream)) {
      return {type: 'nl'};
   }

   let indent = $.consumeSpaces(stream);
   if (indent <= myindent) {
      $.unconsume(stream);
      return null;
   }

   if ($.consumeCommentStart(stream)) {
      return $.readComment(stream);
   }
  
   if ($.consumeLineContinuation(stream)) {
      return $.readInlineSyntaxesUntilEol(stream);
   }

   return $.readIndentedSyntax(stream, indent);
}
readComment ::= function (stream) {
   let lines = [];
   let myindent = stream.col;

   for (;;) {
      let line = $.consumeToEol(stream);
      lines.push(line);
      
      if ($.consumeAtMostSpaces(stream, myindent))
         ;
      else {
         $.unconsume(stream);
         break;
      }
   }
   
   return {
      type: 'comment',
      lines
   }
}
readIndentedSyntax ::= function (stream, myindent) {
   let token = $.consumeToken(stream);
   if (token.what !== 'word') {
      $.unconsume(stream);
      throw new Error(`Illegal token at the start of the line: ${token.what}`);
   }
   
   let head = token.word;
   let tail = $.readInlineSyntaxesUntilEol(stream);

   if ($.lookingAtMoreIndented(stream, myindent)) {
      tail.push({type: 'nl'});
      do {
         let sub = $.readFromNewline(stream, myindent);
         
         if (Array.isArray(sub)) {
            tail.push(...sub);
         }
         else {
            tail.push(sub);
         }
      }
      while ($.lookingAtMoreIndented(stream, myindent));
   }
   
   return {
      type: 'stx',
      head,
      tail
   }
}
readInlineSyntaxesUntilEol ::= function (stream) {
   let stxs = [], stx;
   
   for (;;) {
      let stx = $.readInlineSyntax(stream, false);
      if (stx === null) {
         break;
      }
      stxs.push(stx);
   }
   
   return stxs;
}
readInlineSyntax ::= function (stream, isNested) {
   let token = $.consumeToken(stream);
   
   if (token.what === 'nl') {
      if (isNested) {
         throw new Error(`Unexpected end of line`);
      }
      else {
         return null;
      }
   }
   if (token.what === ')') {
      if (isNested) {
         return null;
      }
      else {
         throw new Error(`Unbalanced parentheses`);
      }
   }
   
   if (token.what === 'word') {
      return {
         type: 'id',
         name: token.word
      }
   }
   
   if (token.what === '(') {
      let head = $.readHead(stream);
      let tail = $.readTail(stream);
      return {
         type: 'stx',
         head,
         tail
      };
   }
   
   if (token.what === ':(') {
      let tail = $.readTail(stream);
      return {
         type: 'stx',
         head: ':',
         tail
      };
   }
   
   throw new Error(`Unexpected token: ${token.what}`);
}
readHead ::= function (stream) {
   let token = $.consumeToken(stream);
   
   if (token.what !== 'word') {
      $.unconsume(stream);

      if (token.what === ')') {
         return null;
      }
      
      throw new Error(`Expected a head of a syntax object`);
   }
   
   return token.word;
}
readTail ::= function (stream) {
   let tail = [];
   for (;;) {
      let stx = $.readInlineSyntax(stream, true);
      if (stx === null) {
         break;
      }
      
      tail.push(stx);
   }
   
   return tail;
}
