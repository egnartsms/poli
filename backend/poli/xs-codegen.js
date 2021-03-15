common
   parameterize
-----
result ::= ({val: null})
indent ::= ({val: 0})
emit ::= function (s) {
   $.result.val.push(s);
}
emitIndent ::= function () {
   $.emit('\x20'.repeat(3).repeat($.indent.val));
}
genCodeByFintree ::= function (fintree) {
   return $.parameterize([$.result, []], () => {
      $.cgenExpr(fintree);
      return $.result.val.join('');
   });
}
cgenExpr ::= function (node) {
   switch (node.type) {
      case 'literal':
         $.cgenLiteral(node);
         break;
      
      case 'ref':
         $.emit(node.name);
         break;
      
      case 'funcall':
         $.cgenFuncall(node);
         break;
      
      case 'func':
         $.cgenFunc(node);
         break;
      
   }
}
cgenLiteral ::= function (node) {
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
cgenFuncall ::= function (node) {
   $.cgenExpr(node.fun);
   $.emit('(');
   
   let needComma = false;
   for (let arg of node.args) {
      if (needComma) {
         $.emit(', ');
      }
      else {
         needComma = true;
      }
      $.cgenExpr(arg);
   }
   
   $.emit(')');
}
cgenFunc ::= function (node) {
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
         $.cgenStmt(stmt);
         $.emit(';');
      }
   });
   
   $.emit('\n');
   $.emitIndent();
   $.emit('}');
}
cgenStmt ::= function (node) {
   switch (node.type) {
      case 'expr-stmt':
         $.cgenExpr(node.expr);
         break;
      
      case 'let':
         $.cgenLet(node);
         break;
      
      case 'return':
         $.cgenReturn(node);
         break;
      
      case 'assignment':
         $.cgenAssignment(node);
         break;
      
      default:
         throw new Error;
   }
}
cgenLet ::= function (node) {
   $.emit('let ');
   $.emit(node.var);
   if (node.expr !== null) {
      $.emit(' = ');
      $.cgenExpr(node.expr);
   }
}
cgenReturn ::= function (node) {
   $.emit('return');
   if (node.expr !== null) {
      $.emit(' ');
      $.cgenExpr(node.expr);
   }
}
cgenAssignment ::= function (node) {
   $.cgenAssignmentTarget(node.lhs);
   $.emit(' = ');
   $.cgenExpr(node.rhs);
}
cgenAssignmentTarget ::= function (target) {
   switch (target.type) {
      case 'ref':
         $.emit(target.name);
         break;
      
      case '.':
         $.cgenAssignmentTarget(target.target)
         $.emit('.');
         $.emit(target.prop);
         break;
      
      default:
         throw new Error;
   }
}
