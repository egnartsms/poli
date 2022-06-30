common
   checkLike
dedb-base
   resetFacts
   baseRelation
   addFact
   replaceWhere
dedb-aggregate
   aggregatedRelation
dedb-query
   queryAtMostOne
dedb-aggregators
   concatenate
   sum
   min
-----

countryCity ::=
   $.baseRelation({
      name: 'countryCity',
      attrs: ['country', 'city', 'big', 'population'],
      indices: [['country', 'city']]
   })

countryData ::=
   $.aggregatedRelation({
      name: 'countryData',
      groupBy: ['country'],
      aggregates: {
         cityList: $.concatenate('city', {with: ', ', sortBy: 'big'}),
         population: $.sum('population'),
         minCity: $.min('city', 'population'),
      },
      source: $.countryCity
   })

setup ::=
   function () {
      $.resetFacts($.countryCity, [
         {country: 'ruthenia', city: 'kyiv', big: 1, population: 3000},
         {country: 'ruthenia', city: 'kharkiv', big: 2, population: 1500},
         {country: 'ruthenia', city: 'odessa', big: 3, population: 1070},
         {country: 'ruthenia', city: 'dnipro', big: 4, population: 1030},
         {country: 'ruthenia', city: 'lviv', big: 5, population: 720},

         {country: 'poland', city: 'warsaw', big: 1, population: 3100},
         {country: 'poland', city: 'wroclaw', big: 2, population: 1250},
         {country: 'poland', city: 'gdansk', big: 3, population: 900},
         {country: 'poland', city: 'lodz', big: 4, population: 600},
         {country: 'poland', city: 'poznan', big: 5, population: 500},
      ]);
   }


test_basic ::=
   function () {
      let {cityList, population, minCity} = $.queryAtMostOne(
         $.countryData, {}, {country: 'ruthenia'}
      );

      $.checkLike(cityList, 'kyiv, kharkiv, odessa, dnipro, lviv');
      $.checkLike(population, 3000 + 1500 + 1070 + 1030 + 720);
      $.checkLike(minCity, 'lviv');
   }

test_add_remove ::=
   function () {
      $.addFact($.countryCity, {country: 'ruthenia', city: 'lutsk', population: 350});
      $.replaceWhere($.countryCity, {country: 'ruthenia', city: 'odessa'}, () => null);

      let {cityList, population, minCity} = $.queryAtMostOne(
         $.countryData, {}, {country: 'ruthenia'}
      );

      $.checkLike(cityList, 'kyiv, kharkiv, dnipro, lviv, lutsk');
      $.checkLike(population, 3000 + 1500 + 1030 + 720 + 350);
      $.checkLike(minCity, 'lutsk');
   }
