common
   check

dedb-base
   empty
   makeEntity
   baseRelation
   symEntity

dedb-projection
   projectionFor

-----

protoCountry ::=
   {
   }

Country ::=
   $.baseRelation({
      name: 'Country',
      protoEntity: $.protoCountry,
      attrs: ['name', 'population'],
      indices: [
         ['name', 1]
      ]
   })

Ruthenia ::= null
Poland ::= null
Turkey ::= null


setup ::=
   function () {
      $.empty($.Country);

      $.Ruthenia = $.makeEntity($.protoCountry, {name: 'Ruthenia', population: 40});
      $.Poland = $.makeEntity($.protoCountry, {name: 'Poland', population: 35});
      $.Turkey = $.makeEntity($.protoCountry, {name: 'Turkey', population: 60});
   }


test_basic_attrs ::=
   function () {
      $.check($.Ruthenia.population === 40);
      $.check($.Turkey.population === 60);
   }


test_projection ::=
   function () {
      let proj = $.projectionFor($.Country, {[$.symEntity]: $.Ruthenia});

      $.check(proj.isValid);
      $.check(proj.rec === $.Ruthenia);
   }
