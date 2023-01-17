common
   check
   checkLike

dedb-base
   resetRelation
   addEntity
   removeEntity
   baseRelation
   makeEntity
   refProjectionVersion
   runBatch

dedb-projection
   projectionFor

-----

protoCountry ::=
   {}

country ::=
   $.baseRelation({
      name: 'Country',
      protoEntity: $.protoCountry,
      attrs: ['name', 'continent', 'population'],
      indices: [
         ['name', 1]
      ]
   })


Ruthenia ::= null
Poland ::= null
Turkey ::= null
Pakistan ::= null

setup :thunk:=
   $.resetRelation($.country);

   $.Ruthenia = $.makeEntity($.country, {
      name: 'Ruthenia',
      continent: 'Europe',
      population: 44
   });
   $.addEntity($.Ruthenia);

   $.Poland = $.makeEntity($.country, {
      name: 'Poland',
      continent: 'Europe',
      population: 38
   });
   $.addEntity($.Poland);

   $.Turkey = $.makeEntity($.country, {
      name: 'Turkey',
      continent: 'Asia',
      population: 84
   })
   $.addEntity($.Turkey);

   $.Pakistan = $.makeEntity($.country, {
      name: 'Pakistan',
      continent: 'Asia',
      population: 221
   })
   $.addEntity($.Pakistan);


test_basic_attrs :thunk:=
   $.check($.Ruthenia.population === 44);
   $.check($.Turkey.population === 84);
   $.check($.Pakistan.population === 221);


test_modify_positive :thunk:=
   let ver = $.refProjectionVersion($.country, {continent: 'Asia'});

   $.Pakistan.population += 9;

   $.checkLike(ver.removed.keys(), new Set([$.Pakistan]))
   $.checkLike(ver.added, new Set([$.Pakistan]));

   $.check(ver.removed.get($.Pakistan).population === 221);
   $.check($.Pakistan.population === 230);


test_modify_negative :thunk:=
   let ver = $.refProjectionVersion($.country, {continent: 'Europe'});

   $.Pakistan.population += 9;

   $.check(ver.removed.size === 0);
   $.check(ver.added.size === 0);

   $.check($.Pakistan.population === 230);


test_add_entity :thunk:=
   let ver = $.refProjectionVersion($.country, {});

   let Italy = $.makeEntity($.country, {
      name: 'Italy',
      continent: 'Europe',
      population: 60
   })
   $.addEntity(Italy);

   $.check(ver.removed.size === 0);
   $.checkLike(ver.added, new Set([Italy]));


test_add_remove_entity :thunk:=
   :Add then remove is regarded as a no-op

   let ver = $.refProjectionVersion($.country, {});

   let Italy = $.makeEntity($.country, {
      name: 'Italy',
      continent: 'Europe',
      population: 60
   })
   $.addEntity(Italy);
   $.removeEntity(Italy);

   $.check(ver.removed.size === 0);
   $.check(ver.added.size === 0);


test_remove_add_entity :thunk:=
   :Remove then add is regarded as entity modifications (even if it's not effectively modified).
   let ver = $.refProjectionVersion($.country, {});

   $.removeEntity($.Ruthenia);
   $.addEntity($.Ruthenia);

   $.checkLike(ver.removed.keys(), new Set([$.Ruthenia]))
   $.checkLike(ver.added, new Set([$.Ruthenia]));


test_batch_modify :thunk:=
   let ver = $.refProjectionVersion($.country, {continent: 'Europe'});

   $.runBatch(() => {
      $.Ruthenia.population += 10;
      $.Ruthenia.population -= 3;
   });

   $.checkLike(ver.removed.keys(), new Set([$.Ruthenia]));
   $.checkLike(ver.added, new Set([$.Ruthenia]));

   $.check(ver.removed.get($.Ruthenia).population === 44);
   $.check($.Ruthenia.population === 51);
