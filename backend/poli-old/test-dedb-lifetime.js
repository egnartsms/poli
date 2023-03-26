common
   all
   check
   checkLike

dedb-lifetime
   addRoot
   removeRoot
   ref
   unref
   getMostRecentDeadSet
   obj2node
   isAlive
   isDead

-----

setup :thunk:=
   ;


checkDead ::=
   function (...objects) {
      $.check($.all(objects, $.isDead));
   }


checkAlive ::=
   function (...objects) {
      $.check($.all(objects, $.isAlive));
   }


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

   $.checkDead(C);
   $.checkAlive(A, B);


test_subtree_dead :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);

   $.unref(A, B);

   $.checkDead(B, C);
   $.checkAlive(A);


test_no_dead_tree_rebuild :thunk:=
   let [A, B, C] = $.makeObjects();

   $.addRoot(A);
   $.ref(A, B);
   $.ref(B, C);
   $.ref(A, C);

   $.check($.obj2node.get(C).parentNode === $.obj2node.get(B));

   $.unref(B, C);

   $.checkAlive(A, B, C);
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

   $.checkDead(B, C, D);


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

   $.checkAlive(A, B, C, D, E);
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

   $.checkDead(B, C, D, E);


test_add_subgraph_to_root :thunk:=
   let [A, B, C, D] = $.makeObjects();

   $.ref(A, B);
   $.ref(B, C);
   $.ref(C, D);
   $.ref(D, A);

   $.addRoot(A);

   $.checkAlive(A, B, C, D);

   $.removeRoot(A);

   $.checkDead(A, B, C, D);
