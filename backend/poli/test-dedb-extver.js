common
   check
   isLike
   filter
dedb-base
   baseRelation
   addFact
   removeFact
   changeFact
   revertTo
dedb-rec-key
   recKey
   recVal
dedb-version
   refCurrentStateExt
dedb-common
   RecordType
-----
setup ::= function () {
   let country = $.baseRelation({
      name: 'country',
      recType: $.RecordType.keyVal,
      records: [
         ['ukraine', 'europe'],
         ['poland', 'europe'],
         ['japan', 'asia'],
         ['canada', 'america'],
      ]
   });

   let travel = $.baseRelation({
      name: 'travel',
      recType: $.RecordType.tuple,
      attrs: ['from', 'to'],
      records: [
         {from: 'ukraine', to: 'poland'},
         {from: 'poland', to: 'germany'},
         {from: 'poland', to: 'nl'},
         {from: 'germany', to: 'usa'},
      ]
   })

   return {country, travel};
}
test_rollback_keyed ::= function ({country}) {
   let image = $.refCurrentStateExt(country);

   $.addFact(country, 'germany', 'europe');
   $.addFact(country, 'sweden', 'europe');
   $.removeFact(country, 'japan');
   $.changeFact(country, 'ukraine', 'africa');

   $.revertTo(image);

   $.check($.isLike(country.records, [
      ['ukraine', 'europe'],
      ['poland', 'europe'],
      ['japan', 'asia'],
      ['canada', 'america'],
   ]));
}
test_rollback_nonkeyed ::= function ({travel}) {
   let image = $.refCurrentStateExt(travel);

   $.addFact(travel, {from: 'germany', to: 'poland'});
   $.addFact(travel, {from: 'sweden', to: 'ukraine'});
   for (let rec of $.filter(travel.records, rec => rec.from === 'ukraine')) {
      $.removeFact(travel, rec);
   }
   
   $.revertTo(image);

   $.check($.isLike(travel.records, [
      {from: 'ukraine', to: 'poland'},
      {from: 'poland', to: 'germany'},
      {from: 'poland', to: 'nl'},
      {from: 'germany', to: 'usa'},
   ]));
}