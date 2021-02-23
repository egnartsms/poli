-----
pieces ::= []
emit ::= function (s) {
   $.pieces.push(s);
}
check ::= function (cond, msg) {
   if (!cond) {
      throw new Error(msg);
   }
}
compileToplevel ::= function (syntax) {
   if (!(syntax.stx === '()' && $.isId(syntax.sub[0], 'func'))) {
      throw new Error(`Not a func at top level`);
   }
   
   $.pieces.length = 0;
   
   $.emit('function ');
   
   let args = $.enumIds(syntax.sub[1]);
   let body = syntax.sub.slice(2);
   
   let localNames = Array.from(args);
   
   for (let member of body) {
      if (member.stx !== '()') {
         throw new Error(`Not a compound syntax at function level`);
      }
      if (member.sub.length === 0) {
         throw new Error(`Empty list at function level`);
      }
      
      let head = member.sub[0];
      let tail = member.sub.slice(1);
      
      if (head.stx !== 'id') {
         // TODO: handle this
      }
      
      if (localNames.includes(head.id)) {
         // TODO: handle local var call
      }
      
      // TODO: check for reference to peer entry or imported entry
      
      // TODO: check for reference to globally accessible syntaxes or global JS names
      
      // In case of normal function call:
      $.compileExpr(head);
      $.emit('(');
      if (tail.length > 0) {
         $.compileExpr(tail[0]);
         if (tail.length > 1) {
            for (let arg of tail.slice(1)) {
               $.emit(', ');
               $.compileExpr(arg);
            }
         }
      }
      $.emit(');');
   }
   
}
isId ::= function (syntax, name) {
   return syntax.stx === 'id' && syntax.id === name;
}
isColon ::= function (syntax) {
   return $.isId(syntax, ':');
}
idName ::= function (syntax) {
   $.check(syntax.stx === 'id', `Not an identifier`);
   return syntax.id;
}
enumItems ::= function (syntax) {
   $.check(
      syntax.stx === '()' && syntax.sub.length > 0 && $.isColon(syntax.sub[0]),
      `Not a colon-prefixed syntax`
   );
   return syntax.sub.slice(1);
}
enumIds ::= function (syntax) {
   return Array.from($.enumItems(syntax), $.idName)
}
