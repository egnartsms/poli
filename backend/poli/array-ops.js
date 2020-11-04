util
   arrayInReversedOrder
-----
reversed ::= function (ar) {
    let res = [];
    for (let item of $.arrayInReversedOrder(ar)) {
      res.push(item);
    }
    return res;
}
