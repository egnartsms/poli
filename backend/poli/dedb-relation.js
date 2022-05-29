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

accessorForAttr ::=
   function (rel, attr) {
      $.assert(() => rel.logAttrs.includes($.recVal));

      if (attr === $.recKey) {
         if (rel.isKeyed) {
            return ([rkey, rval]) => rkey;
         }
         else {
            return (rec) => rec;
         }
      }

      if (attr === $.recVal) {
         $.assert(() => rel.isKeyed);

         return ([rkey, rval]) => rval;
      }

      if (isKeyed) {
         return ([rkey, rval]) => rval[attr];
      }
      else {
         return (rec) => rec[attr];
      }
   }

recordCollection ::=
   function (owner) {
      return owner.isKeyed ? $.ExpRecords : $.ImpRecords;
   }

rkeyX2pairFn ::=
   function (owner) {
      if (owner.class === $.clsBaseRelation) {
         return rkey => [rkey, owner.records.valueAtX(rkey)];
      }

      if (owner.class === $.clsDerivedProjection) {
         if (owner.isKeyed) {
            return rkey => [rkey, owner.rkey2rval.get(rkey)]
         }
         else {
            return rkey => [rkey, rkey];
         }
      }

      throw new Error;
   }

rec2pair ::=
   function (owner, rec) {
      return owner.isKeyed ? rec : [rec, rec];
   }

rec2pairFn ::=
   function (owner) {
      return owner.isKeyed ? (rec => rec) : (rec => [rec, rec]);
   }

rec2key ::=
   function (owner, rec) {
      return owner.isKeyed ? rec[0] : rec;
   }

rec2keyFn ::=
   function (owner) {
      return owner.isKeyed ? (([rkey, rval]) => rkey) : (rec => rec);
   }

rec2val ::=
   function (owner, rec) {
      return owner.isKeyed ? rec[1] : rec;
   }

rec2valFn ::=
   function (owner) {
      return owner.isKeyed ? (([rkey, rval]) => rval) : (rec => rec);
   }

pair2rec ::=
   function (owner, rkey, rval) {
      if (owner.isKeyed) {
         return [rkey, rval];
      }
      else {
         $.assert(() => rkey === rval);
         return rkey;
      }
   }
