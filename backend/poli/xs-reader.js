xs-tokenizer
   makeParseStream
   parseStream
-----
assert ::= $_.require('assert').strict
makeTokenStream ::= function (str) {
   let stm = $.makeParseStream(str);
   let gtor = $.parseStream(stm);
    
   return {
      next: null,
      move() {
         let done;

         ({done, value: this.next} = gtor.next());
   
         if (done) {
            this.next = null;
         }
         
         return this.next;
      }
   }
}
readDef ::= function (str) {
   let stm = $.makeTokenStream(str);

   if (stm.move().token !== 'word') {
      throw new Error();
   }
   
   stm.move();
   if (stm.next.token !== 'word' || stm.next.word !== '::=') {
      throw new Error();
   }
   
   stm.move();
   
   
}
readIndentedCompound ::= function (stm) {
   $.assert(stm.next.token === 'indent');
   
   let {level, full} = stm.next;
   
   $.assert(full === true);
   
   
   
}
readLineUnit ::= function (stm) {
   if (stm.next.token === '(') {
      stm.move();
      let head = $.readLineUnit(stm);
      let tail = [];
      while (stm.next.token !== ')' && stm.next.token !== 'nl') {
         tail.push($.readLineUnit(stm));
      }
      
      if (stm.next.token === 'nl') {
         throw new Error(`Unclosed parenthesis`);
      }
      stm.move();
   }
   
   if (stm.next.token === ':(') {
      // TODO: integrate this case into the above
   }
   
   if (stm.next.token === 'word') {
      let stx = {
         stx: 'id',
         id: stm.next.word
      };
      stm.move();
      return stx;
   }
}
