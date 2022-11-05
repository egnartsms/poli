common
   check
   checkLike

dedb-lifetime
   addRoot
   link
   unlink
   setDeadCallback
   obj2node

-----

deadObjects ::= null


setup :thunk:=
   $.setDeadCallback((deadObjects) => {
      $.deadObjects = deadObjects;
   });

   $.deadObjects = null;


makeObjects ::=
   function* () {
      for (;;) {
         yield new Object;
      }
   }


test_one_dead :thunk:=
   let [A, B, C] = $.makeObjects();
   
   $.addRoot(A);
   $.link(A, B);
   $.link(B, C);

   $.unlink(B, C);

   $.checkLike($.deadObjects, new Set([C]))


test_subtree_dead :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.link(A, B);
   $.link(B, C);

   $.unlink(A, B);

   $.checkLike($.deadObjects, new Set([B, C]))


test_no_dead_tree_rebuild :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.link(A, B);
   $.link(B, C);
   $.link(A, C);

   $.check($.obj2node.get(C).parent === $.obj2node.get(B));

   $.unlink(B, C);

   $.check($.deadObjects === null);
   $.check($.obj2node.get(C).parent === $.obj2node.get(A));


test_circular_dead :thunk:=
   let [A, B, C, D] = $.makeObjects();

   $.addRoot(A);
   $.link(A, B);
   $.link(B, C);
   $.link(C, D);
   $.link(D, B);
   $.link(B, D);

   $.unlink(A, B);

   $.checkLike($.deadObjects, new Set([B, C, D]))


test_complex_tree_rebuild :thunk:=
   let [A, B, C, D, E] = $.makeObjects();

   $.addRoot(A);
   $.link(A, B);
   $.link(A, D);
   $.link(B, C);
   $.link(C, D);
   $.link(D, E);
   $.link(E, B);

   $.unlink(A, B);

   $.check($.deadObjects === null);
   $.check($.obj2node.get(B).parent === $.obj2node.get(E));


test_complex_tree_dead_circle :thunk:=
   let [A, B, C, D, E] = $.makeObjects();

   $.addRoot(A);
   $.link(A, B);
   $.link(A, D);
   $.link(B, C);
   $.link(C, D);
   $.link(D, E);
   $.link(E, B);

   $.unlink(A, B);
   $.unlink(A, D);

   $.checkLike($.deadObjects, new Set([B, C, D, E]));
