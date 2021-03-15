common
   parameterize
-----
CompilerError ::= class extends Error {}
module ::= null
entry ::= null
env ::= null
result ::= ({val: null})
indent ::= ({val: 0})
emit ::= function (s) {
   $.result.val.push(s);
}
emitIndent ::= function () {
   $.emit('\x20'.repeat(3).repeat($.indent.val));
}
compileFinalized ::= function (fintree) {
   return $.parameterize([$.result, []], () => {
      $.compileExpr(fintree);
      return $.result.val.join('');
   });
}
compileExpr ::= function (node) {
   switch (node.type) {
      case 'literal':
         $.compileLiteral(node);
         break;
      
      case 'ref':
         $.emit(node.name);
         break;
      
      case 'funcall':
         $.compileFuncall(node);
         break;
      
      case 'func':
         $.compileFunc(node);
         break;
      
   }
}
compileLiteral ::= function (node) {
   if (node.str !== undefined) {
      $.emit(JSON.stringify(node.str));
   }
   else if (node.num !== undefined) {
      $.emit(node.num);
   }
   else {
      throw new Error;
   }
}
compileFuncall ::= function (node) {
   $.compileExpr(node.fun);
   $.emit('(');
   
   let needComma = false;
   for (let arg of node.args) {
      if (needComma) {
         $.emit(', ');
      }
      else {
         needComma = true;
      }
      $.compileExpr(arg);
   }
   
   $.emit(')');
}
compileFunc ::= function (node) {
   $.emit('function (');
   
   let needComma = false;
   for (let arg of node.args) {
      if (needComma) {
         $.emit(', ');
      }
      else {
         needComma = true;
      }
      
      $.emit(arg);
   }
   
   $.emit(') ');
   
   if (node.body.length === 0) {
      $.emit('{}');
      return;
   }
   
   $.emit('{');
   
   $.parameterize([$.indent, $.indent.val + 1], () => {
      for (let stmt of node.body) {
         $.emit('\n');
         $.emitIndent();
         $.compileStmt(stmt);
         $.emit(';');
      }
   });
   
   $.emit('\n');
   $.emitIndent();
   $.emit('}');
}
compileStmt ::= function (node) {
   switch (node.type) {
      case 'expr-stmt':
         $.compileExpr(node.expr);
         break;
      
      case 'let':
         $.compileLet(node);
         break;
      
      case 'return':
         $.compileReturn(node);
         break;
      
      case 'assignment':
         $.compileAssignment(node);
         break;
      
      default:
         throw new Error;
   }
}
compileLet ::= function (node) {
   $.emit('let ');
   $.emit(node.var);
   if (node.expr !== null) {
      $.emit(' = ');
      $.compileExpr(node.expr);
   }
}
compileReturn ::= function (node) {
   $.emit('return');
   if (node.expr !== null) {
      $.emit(' ');
      $.compileExpr(node.expr);
   }
}
compileAssignment ::= function (node) {
   $.compileAssignmentTarget(node.lhs);
   $.emit(' = ');
   $.compileExpr(node.rhs);
}
compileAssignmentTarget ::= function (target) {
   switch (target.type) {
      case 'ref':
         $.emit(target.name);
         break;
      
      case '.':
         $.compileAssignmentTarget(target.target)
         $.emit('.');
         $.emit(target.prop);
         break;
      
      default:
         throw new Error;
   }
}
