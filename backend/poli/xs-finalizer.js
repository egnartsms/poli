bootstrap
   assert
   hasOwnProperty
common
   parameterize
xs-compiler
   CompilerError
-----
globalNames ::= [
   'console',
   'Array',
   'Object'
]
curModule ::= ({val: null})
curEntry ::= ({val: null})
curBlock ::= ({val: null})
hasKeyed ::= function (syntax) {
   return syntax.keyed !== undefined && syntax.keyed.length > 0;
}
isLocalName ::= function (name) {
   let block = $.curBlock.val;
   
   while (block !== null) {
      if (block.names.includes(name)) {
         return true;
      }
      block = block.parent;
   }
   
   return false;
}
isModuleEntryName ::= function (name) {
   return $.hasOwnProperty($.curModule.val.defs, name);
}
isGlobalName ::= function (name) {
   return $.globalNames.includes(name);
}
isId ::= function (syntax) {
   return syntax.id !== undefined;
}
isIdNamed ::= function (syntax, name) {
   return syntax.id === name;
}
isColon ::= function (syntax) {
   return $.isIdNamed(syntax, ':');
}
isCompound ::= function (syntax) {
   return syntax.head !== undefined;
}
isNonemptyCompound ::= function (syntax) {
   return $.isCompound(syntax) && syntax.head !== null;
}
isCompoundHeaded ::= function (syntax, headname) {
   return syntax.head != null && syntax.head.id === headname;
}
checkNoKeyedBodies ::= function (syntax) {
   if ($.hasKeyed(syntax)) {
      throw new $.CompilerError(`Keyed bodies not expected`);
   }
}
isEnumForm ::= function (syntax) {
   if (syntax.head != null && $.isColon(syntax.head)) {
      $.checkNoKeyedBodies(syntax);
      return true;
   }
   else
      return false;
}
enumNames ::= function (syntax) {
   if (!$.isEnumForm(syntax)) {
      throw new $.CompilerError(`Not an enumeration form`);
   }
   
   let names = [];
   
   for (let sub of syntax.body) {
      if (!$.isId(sub)) {
         throw new $.CompilerError(`Not an id`);
      }
      names.push(sub.id);
   }
   
   return names;
}
expandDottedId ::= function (syntax) {
   if (!syntax.id.includes('.')) {
      return syntax;
   }
   
   let parts = syntax.id.split(/\./);
   $.assert(parts.length >= 2);
   
   return {
      head: {id: '.'},
      body: parts.map(part => ({id: part}))
   }
}
finalizeModuleEntry ::= function (module, entry) {
   let syntax = module.defs[entry].stx;
    
   return $.parameterize([$.curModule, module, $.curEntry, entry], () => {
      return $.finalizeExpr(syntax);
   });
}
finalizeExpr ::= function (syntax) {
   if (syntax.id !== undefined) {
      return $.finalizeId(syntax.id);
   }
   
   if (syntax.str !== undefined) {
      return {
         type: 'literal',
         str: syntax.str
      };
   }
   
   if (syntax.num !== undefined) {
      return {
         type: 'literal',
         num: syntax.num
      };
   }
   
   if (syntax.head !== undefined) {
      return $.finalizeCompoundExpr(syntax);
   }
   
   throw new $.CompilerError(`Wrong syntax object at expr position`);
}
finalizeId ::= function (name) {
   if (name.includes('.')) {
      throw new $.CompilerError(`Not impl`);
   }
   
   if ($.isLocalName(name)) {
      return {
         type: 'ref',
         refkind: 'local',
         name: name
      };
   }

   if ($.isModuleEntryName(name)) {
      return {
         type: 'ref',
         refkind: 'module',
         name: name
      };
   }

   if ($.isGlobalName(name)) {
      return {
         type: 'ref',
         refkind: 'global',
         name: name
      };
   }
   
   throw new $.CompilerError(`Reference to unknown name: '${name}'`);
}
finalizeCompoundExpr ::= function (syntax) {
   $.checkNoKeyedBodies(syntax);
   
   if (syntax.head === null) {
      throw new $.CompilerError(`Empty form`);
   }
   
   if ($.isId(syntax.head)) {
      let headname = syntax.head.id;
      
      if (headname === 'func') {
         return $.finalizeFuncExpr(syntax);
      }
      if (headname === 'call|') {
         return $.finalizeFuncall(syntax.body[0], syntax.body.slice(1));
      }
      // TODO: check headname to not be JS builtin syntax words like if, return, etc.
   }
   
   return $.finalizeFuncall(syntax.head, syntax.body);
}
finalizeFuncall ::= function (fun, args) {
   return {
      type: 'funcall',
      fun: $.finalizeExpr(fun),
      args: args.map($.finalizeExpr),
      parent: null
   };
}
finalizeFuncExpr ::= function (syntax) {
   if (syntax.body.length < 2) {
      throw new $.CompilerError(`Bad function expression syntax`);
   }
   
   let [args, ...body] = syntax.body;
   args = $.enumNames(args);
   
   let {block, stmts} = $.finalizeBlock(body, args);
   
   // TODO: check args for uniqueness
   return {
      type: 'func',
      args: args,
      body: stmts,
      block: block
   };
}
finalizeBlock ::= function (body, startWithNames=null) {
   let names = startWithNames !== null ? Array.from(startWithNames) : [];

   // First extract all the let declarations
   for (let form of body) {
      if ($.looksLikeLet(form)) {
         let var_ = form.body[0].id;

         if (names.includes(var_)) {
            throw new $.CompilerError(`Identifier '${var_}' has already been declared`);
         }
         
         names.push(var_);
      }
   }
   
   // Now process the statements sequentially
   let block = {
      parent: $.curBlock.val,
      names: names
   };
   
   let stmts = $.parameterize([$.curBlock, block], () => body.map($.finalizeStmt));
   
   return {
      block,
      stmts
   };
}
looksLikeLet ::= function (form) {
   return (
      $.isCompoundHeaded(form, 'let') && form.body.length >= 1 && $.isId(form.body[0])
   );
}
finalizeStmt ::= function (form) {
   if ($.isCompound(form)) {
      if (form.head === null) {
         throw new $.CompilerError(`Empty form at stmt position`);
      }
      
      if (!$.isId(form.head)) {
         return {
            type: 'expr-stmt',
            expr: $.finalizeExpr(form)
         };
      }
      
      let head = form.head.id;
      
      switch (head) {
         case 'let':
            return $.finalizeLetStmt(form);
         
         case 'return':
            return $.finalizeReturnStmt(form);

         case '=':
            return $.finalizeAssignmentStmt(form);
         
         default:
            return {
               type: 'expr-stmt',
               expr: $.finalizeExpr(form)
            };
      }
   }
   
   if (syntax.stx === 'nl' || syntax.stx === 'comment') {
      return null;
   }
   
   throw new $.CompilerError(`Invalid statement object`);
}
finalizeLetStmt ::= function (form) {
   $.checkNoKeyedBodies(form);

   function badSyntax() {
      throw new $.CompilerError(`Bad 'let' syntax`);
   }
   
   let expr;
   
   if (form.body.length === 1) {
      expr = null;
   }
   else if (form.body.length === 3 && $.isIdNamed(form.body[1], '=')) {
      expr = form.body[2];
   }
   else {
      badSyntax();
   }
   
   if (!$.isId(form.body[0])) {
      badSyntax();
   }
   
   return {
      type: 'let',
      var: form.body[0].id,
      expr: $.finalizeExpr(expr),
      myblock: $.curBlock.val,
      parent: null  // will be set by the call site
   };
}
finalizeReturnStmt ::= function (form) {
   $.checkNoKeyedBodies(form);
   
   if (form.body.length > 1) {
      throw new $.CompilerError(`Bad syntax`);
   }
   
   return {
      type: 'return',
      expr: form.body.length === 0 ? null : $.finalizeExpr(form.body[0]),
      myblock: $.curBlock.val
   };
}
finalizeAssignmentStmt ::= function (form) {
   $.checkNoKeyedBodies(form);
   
   if (form.body.length !== 2) {
      throw new $.CompilerError(`Bad syntax`);
   }
   
   let [lhs, rhs] = form.body;
   
   return {
      type: 'assignment',
      op: form.head.id,
      lhs: $.finalizeAssignmentTarget(lhs),
      rhs: $.finalizeExpr(rhs),
      parent: null
   };
}
finalizeAssignmentTarget ::= function (lhs) {
   if ($.isId(lhs)) {
      lhs = $.expandDottedId(lhs);
   }
   
   if ($.isId(lhs)) {
      if ($.isLocalName(lhs.id)) {
         return {
            type: 'ref',
            refkind: 'local',
            name: lhs.id
         };
      }
      
      throw new $.CompilerError(`Bad lhs name: '${lhs.id}'`);
   }
   
   if (!$.isNonemptyCompound(lhs)) {
      throw new $.CompilerError(`Bad lhs of assignment`);
   }
   
   if ($.isIdNamed(lhs.head, '.')) {
      return $.finalizeDotAccess(lhs);
   }
   
   throw new $.CompilerError(`Bad lhs of assignment`);
}
finalizeDotAccess ::= function (syntax) {
   $.checkNoKeyedBodies(syntax);
   
   if (syntax.body.length < 2) {
      throw new $.CompilerError(`Bad . syntax`);
   }
   
   let target = $.finalizeExpr(syntax.body[0]);
   let i = 1;
   
   while (i < syntax.body.length) {
      if (!$.isId(syntax.body[i])) {
         throw new $.CompilerError(`Bad . syntax`);
      }
      
      target = {
         type: '.',
         target: target,
         prop: syntax.body[i].id
      };
   }
   
   return target;
}
