common
   check
   hasOwnProperty
   parameterize
-----
FinalizeError ::= class extends Error {}
globalNames ::= [
   'console',
   'Array',
   'Object'
]
curModule ::= ({val: null})
curBlock ::= ({val: null})
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
   return syntax.head != null;
}
isEmptyCompound ::= function (syntax) {
   return syntax.head === null;
}
isHeadedCompound ::= function (syntax, headname) {
   return $.isNonemptyCompound(syntax) && syntax.head.id === headname;
}
isEnumeration ::= function (syntax) {
   return $.isNonemptyCompound(syntax) && $.isColon(syntax.head);
}
enumNames ::= function (syntax) {
   if (!$.isEnumeration(syntax)) {
      throw new $.FinalizeError(`Not an enumeration form`);
   }
   
   let names = [];
   
   for (let sub of syntax.body) {
      if (!$.isId(sub)) {
         throw new $.FinalizeError(`Not an id`);
      }
      names.push(sub.id);
   }
   
   return names;
}
finalizeSyntax ::= function (module, syntax) {
   return $.parameterize(
      [$.curModule, module],
      () => $.finalizeExpr(syntax)
   );
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
   
   throw new $.FinalizeError(`Wrong syntax object at expr position`);
}
finalizeId ::= function (name) {
   if (name.includes('.')) {
      throw new $.FinalizeError(`Dotted Identifiers not impl`);
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
   
   return {
      type: 'ref',
      refkind: 'unknown',
      name: name
   };
}
finalizeCompoundExpr ::= function (compound) {
   if ($.isEmptyCompound(compound)) {
      throw new $.FinalizeError(`Empty form`);
   }
   
   if ($.isId(compound.head)) {
      let headname = compound.head.id;
      
      if (headname === 'func') {
         return $.finalizeFuncExpr(compound);
      }
      if (headname === 'call|') {
         if (compound.body.length === 0) {
            throw new $.FinalizeError(`call| with no args`);
         }
         return $.finalizeFuncall(compound.body[0], compound.body.slice(1));
      }
      // TODO: check headname to not be JS builtin syntax words like if, return, etc.
   }
   
   return $.finalizeFuncall(compound.head, compound.body);
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
      throw new $.FinalizeError(`Bad function expression syntax`);
   }
   
   let [args, ...body] = syntax.body;
   args = $.enumNames(args);
   
   let {block, stmts} = $.finalizeBlock(body, args);
   
   // TODO: check args for uniqueness
   return {
      type: 'func',
      args: args,
      body: stmts,
      block: block,
      parent: null
   };
}
finalizeBlock ::= function (body, startWithNames=null) {
   let names = startWithNames !== null ? Array.from(startWithNames) : [];

   // First extract all the let declarations
   for (let form of body) {
      if ($.looksLikeLet(form)) {
         let var_ = form.body[0].id;

         if (names.includes(var_)) {
            throw new $.FinalizeError(`Identifier '${var_}' has already been declared`);
         }
         
         names.push(var_);
      }
   }
   
   // Now process the statements sequentially
   let block = {
      parent: $.curBlock.val,
      names: names
   };
   
   let stmts = $.parameterize(
      [$.curBlock, block],
      () => body.map($.finalizeStmt).filter(stmt => stmt !== null)
   );
   
   return {
      block,
      stmts
   };
}
looksLikeLet ::= function (form) {
   return (
      $.isHeadedCompound(form, 'let') && form.body.length >= 1 && $.isId(form.body[0])
   );
}
finalizeStmt ::= function (form) {
   if ($.isCompound(form)) {
      if ($.isEmptyCompound(form)) {
         throw new $.FinalizeError(`Empty form at stmt position`);
      }
      
      if (!$.isId(form.head)) {
         return {
            type: 'expr-stmt',
            expr: $.finalizeExpr(form),
            parent: null
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
               expr: $.finalizeExpr(form),
               parent: null
            };
      }
   }
   
   if (form.blank !== undefined) {
      return null;
   }
   
   throw new $.FinalizeError(`Invalid statement object`);
}
finalizeLetStmt ::= function (form) {
   function badSyntax() {
      throw new $.FinalizeError(`Bad 'let' syntax`);
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
      expr: expr === null ? expr : $.finalizeExpr(expr),
      parent: null  // will be set by the call site
   };
}
finalizeReturnStmt ::= function (form) {
   if (form.body.length > 1) {
      throw new $.FinalizeError(`Bad syntax`);
   }
   
   return {
      type: 'return',
      expr: form.body.length === 0 ? null : $.finalizeExpr(form.body[0]),
      parent: null
   };
}
finalizeAssignmentStmt ::= function (form) {
   if (form.body.length !== 2) {
      throw new $.FinalizeError(`Bad syntax`);
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
      lhs = $.expandDottedId(lhs.id);
   }
   
   if ($.isId(lhs)) {
      if ($.isLocalName(lhs.id)) {
         return {
            type: 'ref',
            refkind: 'local',
            name: lhs.id
         };
      }
      else {
         return {
            type: 'ref',
            refkind: 'unknown',
            name: lhs.id
         };
      }
   }
   
   if ($.isHeadedCompound(lhs, '.')) {
      return $.finalizeDotAssignmentTarget(lhs);
   }
   
   throw new $.FinalizeError(`Bad lhs of assignment`);
}
expandDottedId ::= function (id) {
   if (!id.includes('.')) {
      return syntax;
   }
   
   let parts = id.split(/\./);
   $.check(parts.length >= 2);
   
   return {
      head: {id: '.'},
      body: parts.map(part => ({id: part}))
   }
}
finalizeDotAssignmentTarget ::= function (syntax) {
   if (syntax.body.length < 2) {
      throw new $.FinalizeError(`Bad . syntax`);
   }
   
   let target = $.finalizeExpr(syntax.body[0]);
   let i = 1;
   
   while (i < syntax.body.length) {
      if (!$.isId(syntax.body[i])) {
         throw new $.FinalizeError(`Bad . syntax`);
      }
      
      target = {
         type: '.',
         target: target,
         prop: syntax.body[i].id,
         parent: null
      };
      
      i += 1;
   }
   
   return target;
}
