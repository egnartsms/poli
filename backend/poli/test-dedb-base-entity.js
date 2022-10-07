common
   check
   checkLike

dedb-base
   resetRelation
   addEntity
   removeEntity
   baseRelation
   makeEntity
   refSubVersion

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

setup ::=
   function () {
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
   }


test_basic_attrs ::=
   function () {
      $.check($.Ruthenia.population === 44);
      $.check($.Turkey.population === 84);
      $.check($.Pakistan.population === 221);
   }


test_modify_positive ::=
   function () {
      let ver = $.refSubVersion($.country, {continent: 'Asia'});

      $.Pakistan.population += 9;

      $.checkLike(ver.removed.keys(), new Set([$.Pakistan]))
      $.checkLike(ver.added, new Set([$.Pakistan]));

      $.check(ver.removed.get($.Pakistan).population === 221);
      $.check($.Pakistan.population === 230);
   }


test_modify_negative ::=
   function () {
      let ver = $.refSubVersion($.country, {continent: 'Europe'});

      $.Pakistan.population += 9;

      $.check(ver.removed.size === 0);
      $.check(ver.added.size === 0);

      $.check($.Pakistan.population === 230);
   }


test_add_entity ::=
   function () {
      let ver = $.refSubVersion($.country, {});

      let Italy = $.makeEntity($.country, {
         name: 'Italy',
         continent: 'Europe',
         population: 60
      })
      $.addEntity(Italy);

      $.check(ver.removed.size === 0);
      $.checkLike(ver.added, new Set([Italy]));
   }


test_add_remove_entity ::=
   :Add then remove is regarded as a no-op
   function () {
      let ver = $.refSubVersion($.country, {});

      let Italy = $.makeEntity($.country, {
         name: 'Italy',
         continent: 'Europe',
         population: 60
      })
      $.addEntity(Italy);
      $.removeEntity(Italy);

      $.check(ver.removed.size === 0);
      $.check(ver.added.size === 0);
   }


test_remove_add_entity ::=
   :Remove then add is regarded as entity modifications (even if it's not effectively modified).
   function () {
      let ver = $.refSubVersion($.country, {});

      $.removeEntity($.Ruthenia);
      $.addEntity($.Ruthenia);

      $.checkLike(ver.removed.keys(), new Set([$.Ruthenia]))
      $.checkLike(ver.added, new Set([$.Ruthenia]));
   }


test_batch_modify ::=
   function () {
      
   }


ztest_projection ::=
   function () {
      let proj = $.projectionFor($.Country, {[$.entity]: $.Ruthenia});

      $.check(proj.isValid);
      $.check(proj.rec === $.Ruthenia[$.Country.recSym]);
   }
