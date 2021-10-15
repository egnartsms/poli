prolog-goal
   or
prolog-base
   baseRelation
prolog-derived
   derivedRelation
   rebuildProjection
prolog-index
   indexOn
prolog-projection
   projectionFor
-----
setup ::= function () {
   let country = $.baseRelation({
      name: 'country',
      attrs: ['name', 'population'],
      indices: [
         $.indexOn(['name'], {isUnique: true})
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
   });

   let good_countries = $.baseRelation({
      name: 'good_countries',
      attrs: ['country'],
      indices: [
         $.indexOn(['country'], {isUnique: true})
      ],
      records: [
         {country: 'canada'},
         {country: 'france'},
         {country: 'england'}
      ]
   });

   let important_countries = $.baseRelation({
      name: 'important_countries',
      attrs: ['country'],
      indices: [
         $.indexOn(['country'], {isUnique: true})
      ],
      records: [
         {country: 'usa'},
         {country: 'china'}
      ]
   });

   let pop = $.derivedRelation({
      name: 'pop',
      attrs: ['country', 'population'],
      body: v => [
         country.at({
            name: v`country`,
            population: v`population`
         }),
         $.or(
            good_countries.at({
               country: v`country`
            }),
            important_countries.at({
               country: v`country`
            })
         )
      ]
   });

   return {pop}
}
test_basic ::= function ({pop}) {
   let proj = $.projectionFor(pop, {country: 'usa'});
   // console.log(proj.records);
}
