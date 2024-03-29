common
   check
   isLike
   checkLike
dedb-goal
   use
   or
dedb-query
   query
dedb-base
   baseRelation
   resetFacts
dedb-derived
   derivedRelation
-----
country ::=
   $.baseRelation({
      name: 'country',
      attrs: ['name', 'population'],
      indices: [
         ['name', 1]
      ]
   })

goodCountries ::=
   $.baseRelation({
      name: 'goodCountries',
      attrs: ['country'],
      indices: [
         ['country', 1]
      ]
   })

importantCountries ::=
   $.baseRelation({
      name: 'importantCountries',
      attrs: ['country'],
      indices: [
         ['country', 1]
      ]
   })

relevantCountryPopulation ::=
   $.derivedRelation({
      name: 'relevantCountryPopulation',
      attrs: ['country', 'population'],
      body: v => [
         $.use($.country, {
            name: v`country`,
            population: v`population`
         }),
         $.or(
            $.use($.goodCountries, {country: v`country`}),
            $.use($.importantCountries, {country: v`country`})
         )
      ]
   })

setup ::=
   function () {
      $.resetFacts($.country, [
         {name: 'usa', population: 300},
         {name: 'canada', population: 35},
         {name: 'france', population: 67},
         {name: 'england', population: 56},
         {name: 'north korea', population: 26},
         {name: 'china', population: 1398},
         {name: 'russia', population: 144},
      ]);

      $.resetFacts($.goodCountries, [
         {country: 'canada'},
         {country: 'france'},
         {country: 'england'}
      ]);

      $.resetFacts($.importantCountries, [
         {country: 'usa'},
         {country: 'china'}
      ]);
   }

test_basic ::=
   function () {
      $.checkLike(
         $.query($.relevantCountryPopulation, {}),
         new Set([
            {country: 'canada', population: 35},
            {country: 'france', population: 67},
            {country: 'england', population: 56},
            {country: 'usa', population: 300},
            {country: 'china', population: 1398}
         ])
      );
   }
