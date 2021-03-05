xs-tokenizer
   indSpaces
   partialIndSpaces
-----
multilined2str ::= function (stx) {
   return Array.from($.dumpMultilined(stx, 0)).join('');
}
dumpsNext ::= function (stx, level) {
   return Array.from($.dumpNext(stx, level)).join('');
}
dumpMultilined ::= function* (stx, level) {
   if (stx.blank === '\n') {
      return;
   }
   
   if (stx.commentLines !== undefined) {
      yield* $.dumpComment(stx, level);
      return;
   }
   
   if (stx.head === null) {
      throw new Error(`Invalid syntax object: multilined compound is empty`);
   }
   
   if (stx.head === undefined) {
      throw new Error(`Invalid syntax object: ${stx}`);  // TODO: don't dump whole stx
   }
   
   yield* $.dumpInline(stx.head);
   
   for (let sub of stx.body) {
      yield* $.dumpNext(sub, level);
   }
   
   if (stx.keyed !== undefined) {
      for (let {key, body} of stx.keyed) {
         yield '\n';
         yield* $.partIndent(level);
         yield key;
         yield ':';
         
         for (let sub of body) {
            yield* $.dumpNext(sub, level);
         }
      }
   }
}
dumpNext ::= function* (stx, level) {
   if (stx.nl === undefined) {
      throw new Error(`The .nl property is not set for syntax object`);
   }
   
   if (stx.nl === 0) {
      yield ' ';
      yield* $.dumpInline(stx);
   }
   else if (stx.nl < 0) {
      yield '\n';
      yield* $.indent(level + (-stx.nl));
      yield '\\ ';
      yield* $.dumpInline(stx);
   }
   else {
      yield '\n';
      yield* $.indent(level + stx.nl);
      yield* $.dumpMultilined(stx, level + stx.nl);
   }
}
dumpComment ::= function* (comment, level) {
   let commentLines = comment.commentLines;

   yield '#;';
   if (commentLines[0]) {
      yield ' ';
      yield commentLines[0];
   }
   
   for (let i = 1; i < commentLines.length; i += 1) {
      yield '\n';
      yield* $.indent(level + 1);
      yield commentLines[i];
   }
}
indent ::= function* (level) {
   yield ' '.repeat($.indSpaces).repeat(level);
}
partIndent ::= function* (level) {
   yield ' '.repeat($.indSpaces).repeat(level);
   yield ' '.repeat($.partialIndSpaces);
}
dumpInline ::= function* (stx) {
   if (stx.blank === '\\')
      ;
   else if (stx.head !== undefined) {
      let i;

      if (stx.head === null) {
         yield '()';
      }
      else {
         let needSpace;
         
         if (stx.head.id === ':') {
            yield ':(';
            needSpace = false;
         }
         else {
            yield '(';
            yield* $.dumpInline(stx.head);
            needSpace = true;
         }
         
         for (let sub of stx.body) {
            if (needSpace) {
               yield ' ';
            }
            yield* $.dumpInline(sub);
            needSpace = true;
         }
         
         yield ')';
      }
   }
   else if (stx.id !== undefined) {
      yield stx.id;
   }
   else if (stx.str !== undefined) {
      yield JSON.stringify(stx.str);
   }
   else if (stx.kw !== undefined) {
      yield stx.kw;
      yield ':';
   }
   else if (stx.num !== undefined) {
      yield String(stx.num);
   }
   else {
      throw new Error(`Unexpected syntax object: ${stx}`);
   }
}
