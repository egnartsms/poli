common
   assert
   isA
dedb-base
   * as: base
dedb-derived
   * as: derived
dedb-functional
   * as: functional
dedb-rec-key
   recKey
   recVal
-----

isStatefulRelation ::=
   function (rel) {
      return rel.kind === 'base' || rel.kind === 'derived';
   }


isEntityRelation ::=
   function (rel) {
      return rel.kind === 'base' && rel.protoEntity !== null;
   }
