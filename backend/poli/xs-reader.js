common
   extendArray
xs-tokenizer
   tokenizeString
-----
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
            stx: 'nl'
         });
      }

      $.move(stm);

      if (stm.next.token === '\\') {
         $.move(stm);

         if (stm.next.token === 'nl') {
            sub.push({
               stx: '\\nl'
            });
            $.move(stm);
         }
         else {
            let continuationLine = $.readToEol(stm);
            $.extendArray(sub, continuationLine);
         }
      }
      else {
         let child = $.readMultilined(stm, level);
         sub.push(child);
      }
   }
   
   return {
      stx: '()',
      sub: sub,
      nl: true
   };
}
readToEol ::= function (stm) {
   let syntaxes = [];
   let first = true;

   while (!$.isAtEol(stm)) {
      let unit = $.readLineUnit(stm);

      if (first) {
         unit.nl = (unit.stx === '()') ? '\\' : true;
         first = false;
      }
      else {
         unit.nl = false;
      }

      syntaxes.push(unit);
   }
   
   $.move(stm);

   return syntaxes;
}
readLineUnit ::= function (stm) {
   switch (stm.next.token) {
      case 'word': {
         let stx = {
            stx: 'id',
            id: stm.next.word
         };
         $.move(stm);
         return stx;
      }
      
      case 'string': {
         let stx = {
            stx: 'str',
            str: stm.next.string
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
         id: ':'
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
      sub: sub
   }
}
