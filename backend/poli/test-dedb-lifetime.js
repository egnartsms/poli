common
   check
   checkLike

dedb-lifetime
   addRoot
   removeRoot
   ref
   unref
   getMostRecentDeadSet
   obj2node

-----

setup :thunk:=
   ;


makeObjects ::=
   function* () {
      for (;;) {
         yield new Object;
      }
   }


test_one_dead :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);

   $.unref(B, C);

   $.checkLike($.getMostRecentDeadSet(), new Set([C]))


test_subtree_dead :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);

   $.unref(A, B);

   $.checkLike($.getMostRecentDeadSet(), new Set([B, C]))


test_no_dead_tree_rebuild :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);
   $.ref(A, C);

   $.check($.obj2node.get(C).parentNode === $.obj2node.get(B));

   $.unref(B, C);

   $.check($.getMostRecentDeadSet() === null);
   $.check($.obj2node.get(C).parentNode === $.obj2node.get(A));


test_circular_dead :thunk:=
   let [A, B, C, D] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);
   $.ref(C, D);
   $.ref(D, B);
   $.ref(B, D);

   $.unref(A, B);

   $.checkLike($.getMostRecentDeadSet(), new Set([B, C, D]))


test_complex_tree_rebuild :thunk:=
   let [A, B, C, D, E] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(A, D);
   $.ref(B, C);
   $.ref(C, D);
   $.ref(D, E);
   $.ref(E, B);

   $.unref(A, B);

   $.check($.getMostRecentDeadSet() === null);
   $.check($.obj2node.get(B).parentNode === $.obj2node.get(E));


test_complex_tree_dead_circle :thunk:=
   let [A, B, C, D, E] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(A, D);
   $.ref(B, C);
   $.ref(C, D);
   $.ref(D, E);
   $.ref(E, B);

   $.unref(A, B);
   $.unref(A, D);

   $.checkLike($.getMostRecentDeadSet(), new Set([B, C, D, E]));


test_add_subgraph_to_root :thunk:=
   let [A, B, C, D] = $.makeObjects();

   $.ref(A, B);
   $.ref(B, C);
   $.ref(C, D);
   $.ref(D, A);

   $.addRoot(A);

   $.check($.obj2node.has(A));
   $.check($.obj2node.has(B));
   $.check($.obj2node.has(C));
   $.check($.obj2node.has(D));

   $.removeRoot(A);

   $.checkLike($.getMostRecentDeadSet(), new Set([A, B, C, D]));
