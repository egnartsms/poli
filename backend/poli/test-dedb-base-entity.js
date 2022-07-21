common
   check

dedb-base
   emptyRelation
   addFact
   baseRelation
   entity

dedb-projection
   projectionFor

-----

protoCountry ::=
   {}

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
      $.emptyRelation($.Country);

      $.Ruthenia = {__proto__: $.protoCountry};
      $.addFact($.Country, {name: 'Ruthenia', population: 40, [$.entity]: $.Ruthenia});

      $.Poland = {__proto__: $.protoCountry};
      $.addFact($.Country, {name: 'Poland', population: 35, [$.entity]: $.Poland});

      $.Turkey = {__proto__: $.protoCountry};
      $.addFact($.Country, {name: 'Turkey', population: 60, [$.entity]: $.Turkey});
   }


test_basic_attrs ::=
   function () {
      $.check($.Ruthenia.population === 40);
      $.check($.Turkey.population === 60);
   }


test_projection ::=
   function () {
      let proj = $.projectionFor($.Country, {[$.entity]: $.Ruthenia});

      $.check(proj.isValid);
      $.check(proj.rec === $.Ruthenia[$.Country.recSym]);
   }
