bootstrap
   assert
common
   extendArray
xs-tokenizer
   tokenizeEntryDefinition
   tokenizeFromNewline
-----
makeStream ::= function (str, gtor) {
   let stm = {
      str,  // just to know what we're crunching on, not really functionally used
      gtor,
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
ReaderError ::= class extends Error {
   constructor(stm, message) {
      super();
      this.str = stm.str;
      this.row = stm.next.row;
      this.col = stm.next.col;
      this.message = message;
   }
}
isAtEos ::= function (stm) {
   return stm.next === null;
}
isAtEol ::= function (stm) {
   return stm.next.token === 'nl';
}
read1FromString ::= function (str) {
   let stm = $.makeStream(str, $.tokenizeFromNewline(str));

   $.assert(stm.next.token === 'indent');
   $.assert(stm.next.level === 0);

   $.move(stm);
   
   let stx = $.readMultilined(stm, 0);
   stx.nl = 1;
   return stx;
}
readEntryDefinition ::= function (src) {
   let stm = $.makeStream(src, $.tokenizeEntryDefinition(src));
   let stx;
   
   if ($.isAtEol(stm)) {
      stx = $.readMultilinedEntryDefinition(stm);
   }
   else {
      stx = $.readLineUnit(stm);
      stx.nl = 0;
      $.checkTerminalNewline(stm);
   }
   
   return stx;
}
readMultilinedEntryDefinition ::= function (stm) {
   // Initial state is: looking at EOL in 'entry-name ::='
   $.move(stm);
   
   if (stm.nblanks > 0) {
      throw new $.ReaderError(stm, `Blank line at the entry definition level`);
   }
   
   $.assert(stm.next.token === 'indent');
   
   if (stm.next.level !== 1) {
      throw new $.ReaderError(stm, `Invalid indentation level (expected 1)`);
   }
   if (!stm.next.full) {
      throw new $.ReaderError(stm, `Partial indentation at the entry definition level`);
   }
   
   $.move(stm);
   
   if (stm.next.token === '\\') {
      $.move(stm);
      
      if ($.isAtEol(stm)) {
         throw new $.ReaderError(
            stm, 
            `Empty continuation line at the entry definition level`
         );
      }
      
      let stx = $.readLineUnit(stm);
      stx.nl = -1;
      
      $.checkTerminalNewline(stm);
      
      return stx;
   }
   else if (stm.next.token === 'comment-line') {
      throw new $.ReaderError(stm, `Comment at the entry definition level`);
   }
   else {
      let stx = $.readMultilined(stm, 1);
      stx.nl = 1;
      
      if (!$.isAtEos(stm)) {
         throw new $.ReaderError(stm, `Entry definition consists of >1 items`);
      }
      
      return stx;
   }
}
checkTerminalNewline ::= function (stm) {
   let ok = false;

   if ($.isAtEol(stm)) {
      $.move(stm);
      ok = $.isAtEos(stm);
   }
   
   if (!ok) {
      throw new $.ReaderError(stm, `Entry definition consists of >1 items`);
   }
}
readMultilined ::= function (stm, mylevel) {
   let [head, ...body] = $.readToEol(stm);
   let sink = body;
   let isBodyBeginning = true;   // track possibility of double indentation

   while (!$.isAtEos(stm)) {
      $.assert(stm.next.token === 'indent');

      let {level, full} = stm.next;
      let lvlshift = level - mylevel;

      if (lvlshift <= 0) {
         break;
      }
      
      if (lvlshift === 1) {
         isBodyBeginning = false;
      }
      else if (lvlshift > 2 || !(full && isBodyBeginning)) {
         throw new $.ReaderError(stm, `Line too indented`);
      }
      
      for (let i = 0; i < stm.nblanks; i += 1) {
         // If the current line is partially indented, then all the preceding
         // blank lines become peers of partially-indented subbodies. Otherwise, they go
         // into the current partially-indented subbody.
         (full ? sink : body).push({
            blank: '\n',
            nl: lvlshift
         });
      }

      $.move(stm);

      if (full) {
         if (stm.next.token === '\\') {
            $.move(stm);

            if (stm.next.token === 'nl') {
               sink.push({
                  blank: '\\',
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

         let [subhead, ...subbody] = $.readToEol(stm);
         let sub = {
            head: subhead,
            body: subbody,
            nl: .5
         };
         
         body.push(sub);
         sink = subbody;
         isBodyBeginning = true;
      }
   }
   
   return {
      head: head,
      body: body,
      nl: 0,   // that will be set at the call site
   };
}
readComment ::= function (stm) {
   let lines = [];
   
   while (!$.isAtEos(stm) && stm.next.token === 'comment-line') {
      lines.push(stm.next.line);
      $.move(stm);
   }
   
   return {
      commentLines: lines,
      nl: 0,  // will be set up (to either 1 or 2)
   };
}
readToEol ::= function (stm) {
   let syntaxes = [];

   while (!$.isAtEol(stm)) {
      let syntax = $.readLineUnit(stm);
      syntaxes.push(syntax);
   }
   
   $.move(stm);

   return syntaxes;
}
readLineUnit ::= function (stm) {
   let atom = null;

   switch (stm.next.token) {
      case 'word':
         atom = {
            id: stm.next.word,
            nl: 0
         };
         break;
      
      case 'string':
         atom = {
            str: stm.next.string,
            nl: 0
         };
         break;
      
      case 'number':
         atom = {
            num: stm.next.number,
            nl: 0
         };
         break;

      case 'keyword':
         atom = {
            kw: stm.next.word,
            nl: 0
         }
         break;

      case ')':
         throw new $.ReaderError(stm, `Unexpected closing parenthesis`);
      
      default:
         if (!(stm.next.token === '(' || stm.next.token === ':(')) {
            throw new $.ReaderError(stm, `Unexpected token: ${stm.next.token}`);
         }
   }

   if (atom !== null) {
      $.move(stm);
      return atom;
   }

   let sub = [];
   
   if (stm.next.token === ':(') {
      sub.push({id: ':'});
   }

   $.move(stm);

   while (stm.next.token !== ')' && stm.next.token !== 'nl') {
      sub.push($.readLineUnit(stm));
   }
   
   if (stm.next.token === 'nl') {
      throw new $.ReaderError(stm, `Unclosed parenthesis`);
   }
   
   $.move(stm);
   
   if (sub.length === 0) {
      return {
         head: null,
         body: null,
         nl: 0
      };
   }
   else {
      return {
         head: sub[0],
         body: sub.slice(1),
         nl: 0
      };
   }
}
