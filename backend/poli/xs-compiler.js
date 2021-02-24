bootstrap
   assert
   hasOwnProperty
-----
CompilerError ::= class extends Error {}
globalNames ::= [
   'console',
   'Array',
   'Object'
]
result ::= null
module ::= null
entry ::= null
env ::= null
emit ::= function (s) {
   $.result.push(s);
}
compileModuleEntry ::= function (module, entry) {
   let syntax = module.defs[entry].stx;
   
   $.module = module;
   $.entry = entry;
   $.result = [];
   $.env = [];
   
   try {
      $.compileExpr(syntax);
      return $.result.join('');
   }
   finally {
      $.env = null;
      $.result = null;
      $.entry = null;
      $.module = null;
   }
}
compileExpr ::= function (syntax) {
   switch (syntax.stx) {
      case 'id':
         $.compileId(syntax.id);
         break;
      
      case 'str':
         $.emit(JSON.stringify(syntax.str));
         break;

      case 'num':
         $.emit(syntax.num);
         break;
      
      case '()':
         $.compileCompoundExpr(syntax);
         break;
      
      default:
         throw new Error(`Wrong syntax object at expr position`);
   }
}
compileId ::= function (name) {
   if (name.includes('.')) {
      throw new $.CompilerError(`Not impl`);
   }
   
   if ($.isLocalName(name)) {
      $.emit(name);
   }
   else if ($.isModuleEntryName(name)) {
      $.emit('$.');
      $.emit(name);
   }
   else if ($.isGlobalName(name)) {
      $.emit(name);
   }
   else {
      throw new $.CompilerError(`Reference to unknown name: '${name}'`);
   }
}
isLocalName ::= function (name) {
   for (let i = $.env.length - 1; i >= 0; i -= 1) {
      let blockVars = $.env[i];
      if (blockVars.includes(name)) {
         return true;
      }
   }
   
   return false;
}
isModuleEntryName ::= function (name) {
   return $.hasOwnProperty($.module.defs, name);
}
isGlobalName ::= function (name) {
   return $.globalNames.includes(name);
}
compileCompoundExpr ::= function (syntax) {
   $.assert(syntax.stx === '()');
   if (syntax.sub.length === 0) {
      throw new $.CompilerError(`Empty compound at expr position`);
   }
   
   let head = syntax.sub[0];
   
   if (head.stx !== 'id') {
      throw new $.CompilerError(`Not an id at head pos of a compound`);
   }
   
   let headname = head.id;
   
   if (headname === 'func') {
      $.compileFuncExpr(syntax);
      return;
   }
   
   if ($.isLocalName(headname) || $.isGlobalName(headname)) {
      $.emit(headname);
   }
   else if ($.isModuleEntryName(headname)) {
      $.emit('$.');
      $.emit(headname);
   }
   else {
      throw new $.CompilerError(`Reference to unknown name: '${headname}'`);
   }
   
   $.emit('(');
   
   if (syntax.sub.length > 1) {
      $.compileExpr(syntax.sub[1]);
   }
   
   for (let i = 2; i < syntax.sub.length; i += 1) {
      $.emit(', ');
      $.compileExpr(syntax.sub[i]);
   }
   
   $.emit(')');
}
compileFuncExpr ::= function (syntax) {
   if (syntax.sub.length < 3) {
      throw new $.CompilerError(`Bad function expression syntax`);
   }
   
   let args = $.enumIdNames(syntax.sub[1]);
   let body = syntax.sub.slice(2);
   
   // TODO: check args for uniqueness
   $.emit('function (');
   if (args.length > 0) {
      $.emit(args[0]);
      for (let i = 1; i < args.length; i += 1) {
         $.emit(', ')
         $.emit(args[i]);
      }
   }
   $.emit(') {\n');
   $.compileBlock(body, args);
   $.emit('}');
}
enumIdNames ::= function (syntax) {
   if (!(syntax.stx === '()' && syntax.sub.length > 0 && $.isColon(syntax.sub[0]))) {
      throw new $.CompilerError(`Not an enumeration compound`);
   }
   
   let names = [];
   
   for (let i = 1; i < syntax.sub.length; i += 1) {
      if (syntax.sub[i].stx !== 'id') {
         throw new $.CompilerError(`Not an id`);
      }
      names.push(syntax.sub[i].id);
   }
   
   return names;
}
isColon ::= function (syntax) {
   return $.isId(syntax, ':');
}
isId ::= function (syntax, name) {
   return syntax.stx === 'id' && syntax.id === name;
}
compileBlock ::= function (body, vars=null) {
   vars = vars ? Array.from(vars) : [];

   for (let unit of body) {
      if (unit.stx === '()' && $.isId(unit.sub[0], 'let')) {
         if (unit.sub.length !== 2 && unit.sub.length !== 4) {
            throw new $.CompilerError(`Invalid let form`);
         }
         let id = unit.sub[1];
         if (id.stx !== 'id') {
            throw new $.CompilerError(`Not an identifier in a let form`)
         }
         
         let var_ = id.id;
         if (vars.includes(var_)) {
            throw new $.CompilerError(`Identifier '${var_}' has already been declared`);
         }
         
         vars.push(id.id);
      }
   }
   
   $.env.push(vars);
   try {
      for (let unit of body) {
         $.compileStmt(unit);
      }
   }
   finally {
      $.env.pop();
   }
}
compileStmt ::= function (syntax) {
   if (syntax.stx === '()') {
      if ($.isId(syntax.sub[0], 'let')) {
         let varname = syntax.sub[1].id;
         $.emit('let ');
         $.emit(varname);
         
         if (syntax.sub.length === 4) {
            $.emit(' = ');
            $.compileExpr(syntax.sub[3]);
         }

         $.emit(';\n');
      }
      else {
         $.compileCompoundExpr(syntax);
         $.emit(';\n');
      }
   }
   else if (syntax.stx === 'nl' || syntax.stx === 'comment') {
      
   }
   else {
      throw new $.CompilerError(`Invalid statement object`);
   }
}
