-----
arrayInReversedOrder ::= function* (ar) {
   for (let i = ar.length - 1; i >= 0; i -= 1) {
      yield ar[i];
   }
}
