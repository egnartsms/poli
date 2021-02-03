common
   extendArray
xs-tokenizer
   tokenizeString
-----
read1FromString ::= function (str) {
   let stm = $.makeTokenStream(str);

   $.move(stm);

   $.assert(stm.next.token === 'indent');
   $.assert(stm.next.level === 0);

   $.move(stm);
   
   let stx = $.readMultilined(stm, 0);
   stx.nl = 1;
   return stx;
}
assert ::= $_.require('assert').strict
makeTokenStream ::= function (str) {
   let gtor = $.tokenizeString(str);
    
   return {
      gtor: gtor,
      next: null,
      nblanks: 0
   }
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
   let sub = $.readToEol(stm);
   
   $.assert(sub.length > 0);

   for (;;) {
      if ($.isAtEos(stm)) {
         break;
      }

      $.assert(stm.next.token === 'indent');

      let {level, full} = stm.next;

      if (full !== true) {
         throw new Error(`Not supporting partial indents yet`);
      }

      if (level <= mylevel) {
         break;
      }
      
      if (level > mylevel + 2) {
         throw new Error(`Too much of an indentation`);
      }
      
      for (let i = 0; i < stm.nblanks; i += 1) {
         sub.push({
            stx: 'nl',
            nl: level - mylevel
         });
      }

      $.move(stm);

      if (stm.next.token === '\\') {
         $.move(stm);

         if (stm.next.token === 'nl') {
            sub.push({
               stx: '\\nl',
               nl: -(level - mylevel)
            });
            $.move(stm);
         }
         else {
            let continuationLine = $.readToEol(stm);
            continuationLine[0].nl = -(level - mylevel);
            $.extendArray(sub, continuationLine);
         }
      }
      else if (stm.next.token === 'comment-line') {
         let comment = $.readComment(stm);
         comment.nl = level - mylevel;
         sub.push(comment);
      }
      else {
         let nested = $.readMultilined(stm, level);
         nested.nl = level - mylevel;
         sub.push(nested);
      }
   }
   
   return {
      stx: '()',
      nl: 0,   // that will be fixed up at the call site
      sub: sub,
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
   switch (stm.next.token) {
      case 'word': {
         let stx = {
            stx: 'id',
            id: stm.next.word,
            nl: 0
         };
         $.move(stm);
         return stx;
      }
      
      case 'string': {
         let stx = {
            stx: 'str',
            str: stm.next.string,
            nl: 0
         };
         $.move(stm);
         return stx;
      }
      
      case ')':
         throw new Error(`Unexpected closing parenthesis`);
      
      default:
         $.assert(stm.next.token === '(' || stm.next.token === ':(');
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
