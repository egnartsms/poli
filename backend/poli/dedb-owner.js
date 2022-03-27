dedb-base
   clsBaseRelation
dedb-derived
   clsDerivedProjection
-----
ownerSize ::= function (owner) {
   if (owner.class === $.clsBaseRelation) {
      return owner.records.size;
   }

   if (owner.class === $.clsDerivedProjection) {
      return owner.rkey2subkeys.size;
   }

   throw new Error;
}
ownerKeys ::= function (owner) {
   if (owner.class === $.clsBaseRelation) {
      return owner.records.keys();
   }

   if (owner.class === $.clsDerivedProjection) {
      return owner.rkey2subkeys.keys();
   }

   throw new Error;
}
ownerPairs ::= function (owner) {
   if (owner.kind === 'relation') {
      return owner.records.pairs();
   }

   if (owner.kind === 'projection') {
      if (owner.isKeyed) {
         return owner.rkey2rval.entries();
      }
      else {
         return $.map(owner.rkey2subkeys.keys(), rec => [rec, rec]);
      }
   }

   throw new Error;
}
ownerKeyChecker ::= function (owner) {
   if (owner.class === $.clsBaseRelation) {
      return rkey => owner.records.hasAt(rkey);
   }

   if (owner.class === $.clsDerivedProjection) {
      return rkey => owner.rkey2subkeys.has(rkey);
   }

   throw new Error;
}