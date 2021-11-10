dedb-rec-key
   recKey
   recVal
-----
RecordType ::= ({
   tuple: 'tuple',
   keyVal: 'keyVal',
   keyTuple: 'keyTuple',
})
TupleRecProto ::= ({
   isKeyed: false,
   recType: 'tuple',  // yes, this is a bit dirty. An alternative is to use a getter
   recAttr: Reflect.get,
   recKey(rec) {
      return rec;
   },
   recAt(rkey) {
      return rkey;
   },
   addRecord(rec) {
      this.records.add(rec);
   }
})
KeyValRecProto ::= ({
   isKeyed: true,
   recType: 'keyVal',
   recAttr([key, val], attr) {
      if (attr === $.recKey) {
         return key;
      }
      else if (attr === $.recVal) {
         return val;
      }
      else {
         throw new Error(
            `Access of attribute other than recKey or recVal on a Direct keyed ` +
            `relation`
         );
      }
   },
   recKey([rkey, rval]) {
      return rkey;
   },
   recAt(rkey) {
      let rval = this.records.get(rkey);

      return rval === undefined ? undefined : [rkey, rval];
   },
   addRecord([rkey, rval]) {
      this.records.set(rkey, rval);
   }
})
KeyTupleRecProto ::= ({
   isKeyed: true,
   recType: 'keyTuple',
   recAttr([key, val], attr) {
      return attr === $.recKey ? key : val[attr];
   },
   recKey([rkey, rval]) {
      return rkey;
   },
   recAt(rkey) {
      let rval = this.records.get(rkey);

      return rval === undefined ? undefined : [rkey, rval];
   },
   addRecord([rkey, rval]) {
      this.records.set(rkey, rval);
   }
})
recTypeProto ::= function (recType) {
   if (recType === $.RecordType.tuple) {
      return $.TupleRecProto;
   }
   else if (recType === $.RecordType.keyVal) {
      return $.KeyValRecProto;
   }
   else if (recType === $.RecordType.keyTuple) {
      return $.KeyTupleRecProto;
   }
   else {
      throw new Error;
   }
}
makeRecords ::= function (owner, iterable) {
   let records = new (owner.isKeyed ? Map : Set)(iterable);
   records.owner = owner;
   return records;
}
