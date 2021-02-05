common
   extendArray
xs-tokenizer
   tokenizeString
-----
read1FromString ::= function (str) {
   let stm = $.makeTokenStream(str);

   $.assert(stm.next.token === 'indent');
   $.assert(stm.next.level === 0);

   $.move(stm);
   
   let stx = $.readMultilined(stm, 0);
   stx.nl = 1;
   return stx;
}
readEntryDefinition ::= function (src) {
   let augmSrc = 'fake-header' + src;  // src is not left-trimmed of spaces
   let stm = $.makeTokenStream(augmSrc);
   
   $.assert(stm.next.token === 'indent');
   $.assert(stm.next.level === 0);
   
   $.move(stm);

   let stx = $.readMultilined(stm, 0);
   
   if (stx.sub.length !== 2) {
      throw new Error(`Invalid definition: expected just 1 object, got ` +
                      `${stx.sub.length - 1}`);
   }
   
   stx = stx.sub[1];
   
   return stx;
}
assert ::= $_.require('assert').strict
makeTokenStream ::= function (str) {
   let gtor = $.tokenizeString(str);
   let stm = {
      gtor: gtor,
      next: null,
      nblanks: 0
   };

   $.move(stm);

   return stm;
}
move ::= function (stm) {
   let nblanks = 0;
   let next;
   
   for (;;) {
      let done;
      
      ({done, value: next} = stm.gtor.next());
      
      if (done) {
         next = null;
         break;
      }
      
      if (next.token === 'blank') {
         nblanks += 1;
      }
      else {
         break;
      }
   }
   
   stm.next = next;
   stm.nblanks = nblanks;
   
   return next;
}
isAtEos ::= function (stm) {
   return stm.next === null;
}
isAtEol ::= function (stm) {
   return stm.next.token === 'nl';
}
readMultilined ::= function (stm, mylevel) {
   let children = $.readToEol(stm);

   $.assert(children.length > 0);

   let sink = children;

   for (;;) {
      if ($.isAtEos(stm)) {
         break;
      }

      $.assert(stm.next.token === 'indent');

      let {level, full} = stm.next;
      let lvlshift = level - mylevel;

      if (lvlshift <= 0) {
         break;
      }
      
      if (lvlshift > 2 || (lvlshift === 2 && !full)) {
         throw new Error(`Too much of an indentation`);
      }
      
      for (let i = 0; i < stm.nblanks; i += 1) {
         // If the current line is partially indented, then we shove all the preceding
         // blank lines into the 'children' array rather than 'sink' which may be a
         // container for preceding keyworded body.
         (full ? sink : children).push({
            stx: 'nl',
            nl: lvlshift
         });
      }

      $.move(stm);

      if (full) {
         if (stm.next.token === '\\') {
            $.move(stm);

            if (stm.next.token === 'nl') {
               sink.push({
                  stx: '\\nl',
                  nl: -lvlshift
               });
               $.move(stm);
            }
            else {
               let continuationLine = $.readToEol(stm);
               continuationLine[0].nl = -lvlshift;
               $.extendArray(sink, continuationLine);
            }
         }
         else if (stm.next.token === 'comment-line') {
            let comment = $.readComment(stm);
            comment.nl = lvlshift;
            sink.push(comment);
         }
         else {
            let nested = $.readMultilined(stm, level);
            nested.nl = lvlshift;
            sink.push(nested);
         }
      }
      else {
         $.assert(lvlshift === 1);

         if (stm.next.token !== 'keyword') {
            throw new Error(`Expected a keyword at partially indented position, found ` +
                            `'${stm.next.token}'`);
         }
         let keyword = stm.next.word;

         $.move(stm);
         if (stm.next.token !== 'nl') {
            throw new Error(`Expected a linebreak after a keyword at partially ` +
                            `indented position, found '${stm.next.token}'`);
         }
         $.move(stm);
         
         let compound = {
            stx: '()',
            nl: .5,  // yes, seriously
            sub: [{
               stx: 'kw',
               kw: keyword,
               nl: 0
            }]
         };

         children.push(compound);
         sink = compound.sub;
      }
   }
   
   return {
      stx: '()',
      nl: 0,   // that will be fixed up at the call site
      sub: children,
   };
}
readComment ::= function (stm) {
   let lines = [];
   
   while (!$.isAtEos(stm) && stm.next.token === 'comment-line') {
      lines.push(stm.next.line);
      $.move(stm);
   }
   
   // See if there are any trailing empty comment lines. If yes, they become blank lines
   // for the purpose of further parsing.
   let k = lines.length - 1;
   while (k > 0 && lines[k] === '') {
      k -= 1;
   }
   
   stm.nblanks = lines.length - (k + 1);
   return {
      stx: 'comment',
      nl: 1,
      lines: lines.slice(0, k + 1)
   };
}
readToEol ::= function (stm) {
   let syntaxes = [];

   while (!$.isAtEol(stm)) {
      syntaxes.push($.readLineUnit(stm));
   }
   
   $.move(stm);

   return syntaxes;
}
readLineUnit ::= function (stm) {
   let atom = null;

   switch (stm.next.token) {
      case 'word':
         atom = {
            stx: 'id',
            id: stm.next.word,
            nl: 0
         };
         break;
      
      case 'string':
         atom = {
            stx: 'str',
            str: stm.next.string,
            nl: 0
         };
         break;
      
      case 'number':
         atom = {
            stx: 'num',
            num: stm.next.number,
            nl: 0
         };
         break;

      case 'keyword':
         atom = {
            stx: 'kw',
            kw: stm.next.word,
            nl: 0
         }
         break;

      case ')':
         throw new Error(`Unexpected closing parenthesis`);
      
      default:
         $.assert(stm.next.token === '(' || stm.next.token === ':(');
   }

   if (atom !== null) {
      $.move(stm);
      return atom;
   }

   let sub = [];
   
   if (stm.next.token === ':(') {
      sub.push({
         stx: 'id',
         id: ':',
         nl: 0
      });
   }

   $.move(stm);

   while (stm.next.token !== ')' && stm.next.token !== 'nl') {
      sub.push($.readLineUnit(stm));
   }
   
   if (stm.next.token === 'nl') {
      throw new Error(`Unclosed parenthesis`);
   }
   
   $.move(stm);
   
   return {
      stx: '()',
      nl: 0,
      sub: sub,
   }
}
