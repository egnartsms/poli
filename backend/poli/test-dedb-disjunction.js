common
   check
   isLike
   checkLike
dedb-goal
   join
   or
dedb-relation
   getRelation
dedb-query
   queryRecords
-----
country ::= ({
   name: 'country',
   attrs: ['name', 'population'],
   indices: [
      ['name', 1]
   ],
   records: [
      {name: 'usa', population: 300},
      {name: 'canada', population: 35},
      {name: 'france', population: 67},
      {name: 'england', population: 56},
      {name: 'north korea', population: 26},
      {name: 'china', population: 1398},
      {name: 'russia', population: 144},
   ]
})
goodCountries ::= ({
   name: 'goodCountries',
   attrs: ['country'],
   indices: [
      ['country', 1]
   ],
   records: [
      {country: 'canada'},
      {country: 'france'},
      {country: 'england'}
   ]
})
importantCountries ::= ({
   name: 'importantCountries',
   attrs: ['country'],
   indices: [
      ['country', 1]
   ],
   records: [
      {country: 'usa'},
      {country: 'china'}
   ]
})
relevantCountryPopulation ::= ({
   name: 'relevantCountryPopulation',
   attrs: ['country', 'population'],
   body: v => [
      $.join($.country, {
         name: v`country`,
         population: v`population`
      }),
      $.or(
         $.join($.goodCountries, {country: v`country`}),
         $.join($.importantCountries, {country: v`country`})
      )
   ]
})
test_basic ::= function () {
   $.checkLike(
      new Set($.queryRecords($.relevantCountryPopulation, {})),
      [
         {country: 'canada', population: 35},
         {country: 'france', population: 67},
         {country: 'england', population: 56},
         {country: 'usa', population: 300},
         {country: 'china', population: 1398}
      ]
   );

   // let Pproj = $.projectionFor(pop, {country: 'canada'});

   // $.check($.isLike(Pproj.records, [
   //    {population: 35},
   // ]));
}
