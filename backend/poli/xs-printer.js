xs-tokenizer
   indSpaces
   partialIndSpaces
-----
assert ::= $_.require('assert').strict
serializeSyntax ::= function (stx) {
   let ar = Array.from($.dumpMultilined(stx, 0));
   ar.push('\n')
   return ar.join('');
}
dumpMultilined ::= function* (stx, level) {
   switch (stx.stx) {
      case 'nl':
         return;
      
      case 'comment':
         yield* $.dumpComment(stx, level);
         return;
      
      case '()':
         if (stx.sub.length === 0) {
            throw new Error(`Invalid syntax object: multilined compound is empty`);
         }
         break;
      
      default:
         throw new Error(`Invalid syntax object: ${stx.stx}`);
   }
   
   let amPartial = !Number.isInteger(level);
   let indent = amPartial ? Math.floor(level) : level;

   yield* $.dumpInline(stx.sub[0]);
   
   for (let i = 1; i < stx.sub.length; i += 1) {
      let sub = stx.sub[i];
      
      if (sub.nl === 0) {
         yield ' ';
         yield* $.dumpInline(sub);
      }
      else if (sub.nl < 0) {
         yield '\n';
         yield* $.dumpIndentation(indent - sub.nl);
         yield '\\ ';
         yield* $.dumpInline(sub);
      }
      else {
         if (amPartial && sub.nl === .5) {
            throw new Error(`Invalid syntax object: nested keyword-labeled bodies`);
         }
         
         yield '\n';
         yield* $.dumpIndentation(indent + sub.nl);
         yield* $.dumpMultilined(sub, level + sub.nl);
      }
   }
}
dumpComment ::= function* (comment, level) {
   yield '#;';
   if (comment.lines[0]) {
      yield ' ';
      yield comment.lines[0];
   }
   
   for (let i = 1; i < comment.lines.length; i += 1) {
      yield '\n';
      yield* $.dumpIndentation(level + 1);
      yield comment.lines[i];
   }
}
dumpIndentation ::= function* (level) {
   if (Number.isInteger(level)) {
      yield ' '.repeat($.indSpaces).repeat(level);
   }
   else {
      yield ' '.repeat($.indSpaces).repeat(Math.floor(level));
      yield ' '.repeat($.partialIndSpaces);
   }
}
dumpInline ::= function* (stx) {
   switch (stx.stx) {
      case '\\nl':
         break;

      case '()': {
         let i;

         if (stx.sub.length > 0 && stx.sub[0].stx === 'id' && stx.sub[0].id === ':') {
            yield ':(';
            i = 1;
         }
         else {
            yield '(';
            i = 0;
         }
         
         let needSpace = false;

         for (; i < stx.sub.length; i += 1) {
            if (needSpace) {
               yield ' ';
            }
            yield* $.dumpInline(stx.sub[i]);
            needSpace = true;
         }

         yield ')';
         break;
      }
      
      case 'id':
         yield stx.id;
         break;
      
      case 'str':
         yield JSON.stringify(stx.str);
         break;
      
      case 'kw':
         yield stx.kw;
         break;
      
      case 'num':
         yield stx.num;
         break;
      
      default:
         throw new Error(`Unexpected syntax object: ${stx.stx}`);
   }
}
