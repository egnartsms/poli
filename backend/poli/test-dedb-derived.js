common
	checkLike
dedb-query
	queryRecords
dedb-goal
	join
-----
continent ::= ({
	name: 'continent',
	attrs: ['name'],
	indices: [
	   ['name', 1]
	],
	records: [
	   {name: 'Europe'},
	   {name: 'Asia'},
	   {name: 'America'}
	]
})
country ::= ({
	name: 'country',
	attrs: ['name', 'continent'],
	indices: [
	   ['name', 1],
	   ['continent']
	],
	records: [
	   {continent: 'Europe', name: 'France'},
	   {continent: 'Europe', name: 'Poland'},
	   {continent: 'Europe', name: 'Ruthenia'},
	   {continent: 'Asia', name: 'China'},
	   {continent: 'Asia', name: 'India'},
	   {continent: 'Asia', name: 'Turkey'},
	   {continent: 'America', name: 'Canada'},
	   {continent: 'America', name: 'USA'}
	]
})
city ::= ({
	name: 'city',
	attrs: ['country', 'name', 'population'],
	indices: [
	   ['name', 1],
	   ['country']
	],
	records: [
	   {country: 'France', name: 'Paris', population: 13.024},
	   {country: 'France', name: 'Marseille', population: 1.761},
	   {country: 'France', name: 'Lyon', population: 2.323},

	   {country: 'Poland', name: 'Warsaw', population: 3.100},
	   {country: 'Poland', name: 'Wroclaw', population: 1.250},
	   {country: 'Poland', name: 'Krakow', population: 1.725},

	   {country: 'Ruthenia', name: 'Kyiv', population: 3.375},
	   {country: 'Ruthenia', name: 'Lviv', population: 0.720},
	   {country: 'Ruthenia', name: 'Dnipro', population: 0.993},

	   {country: 'China', name: 'Beijing', population: 21.707},
	   {country: 'China', name: 'Chongqing', population: 30.165},
	   {country: 'China', name: 'Shanghai', population: 24.183},

	   {country: 'India', name: 'Delhi', population: 29.000},
	   {country: 'India', name: 'Mumbai', population: 24.400},
	   {country: 'India', name: 'Bangalore', population: 8.443},

	   {country: 'Turkey', name: 'Istanbul', population: 14.025},
	   {country: 'Turkey', name: 'Ankara', population: 4.587},
	   {country: 'Turkey', name: 'Izmir', population: 2.847},

	   {country: 'Canada', name: 'Toronto', population: 6.417},
	   {country: 'Canada', name: 'Montreal', population: 4.247},
	   {country: 'Canada', name: 'Vancouver', population: 2.463},

	   {country: 'USA', name: 'New York', population: 8.622},
	   {country: 'USA', name: 'Los Angeles', population: 4.085},
	   {country: 'USA', name: 'Chicago', population: 2.670},
	   {country: 'USA', name: 'Houston', population: 2.378},
	]
})
continentCity ::= ({
	name: 'continentCity',
	attrs: ['continent', 'city'],
	potentialIndices: [
	],
	body: v => [
	   $.join($.continent, {name: v`continent`}),
	   $.join($.country, {continent: v`continent`, name: v`country`}),
	   $.join($.city, {country: v`country`, name: v`city`}),
	]
})
test_query_no_bindings ::= function () {
	$.checkLike(
		new Set($.queryRecords($.continentCity, {})),
		[
			{continent: 'Europe', city: 'Paris'},
			{continent: 'Europe', city: 'Marseille'},
			{continent: 'Europe', city: 'Lyon'},
			{continent: 'Europe', city: 'Warsaw'},
			{continent: 'Europe', city: 'Wroclaw'},
			{continent: 'Europe', city: 'Krakow'},
			{continent: 'Europe', city: 'Kyiv'},
			{continent: 'Europe', city: 'Lviv'},
			{continent: 'Europe', city: 'Dnipro'},

			{continent: 'Asia', city: 'Beijing'},
			{continent: 'Asia', city: 'Chongqing'},
			{continent: 'Asia', city: 'Shanghai'},
			{continent: 'Asia', city: 'Delhi'},
			{continent: 'Asia', city: 'Mumbai'},
			{continent: 'Asia', city: 'Bangalore'},
			{continent: 'Asia', city: 'Istanbul'},
			{continent: 'Asia', city: 'Ankara'},
			{continent: 'Asia', city: 'Izmir'},

			{continent: 'America', city: 'Toronto'},
			{continent: 'America', city: 'Montreal'},
			{continent: 'America', city: 'Vancouver'},
			{continent: 'America', city: 'New York'},
			{continent: 'America', city: 'Los Angeles'},
			{continent: 'America', city: 'Chicago'},
			{continent: 'America', city: 'Houston'},
		]
	);
}
legacy ::= function () {
	return;
	test_derived_partial_projection = function ({continent_city}) {
	   $.check($.isLike(
	      $.query(continent_city, {continent: 'America'}),
	      [
	         {city: 'Toronto'},
	         {city: 'Montreal'},
	         {city: 'Vancouver'}
	      ]
	   ));
	}

	test_derived_full_projection_updates = function ({continent_city, continent, city}) {
	   let proj = $.projectionFor(continent_city, {});

	   $.check(proj.records.size === 21);

	   let f_europe = $.find(continent.records, rec => rec.name === 'Europe');
	   $.removeFact(continent, f_europe);
	   $.updateProjection(proj);
	   $.check(proj.records.size === 12);
	   
	   $.addFact(city, {country: 'Ruthenia', name: 'Chernivtsi', population: 0.400})
	   $.addFact(continent, f_europe);
	   $.updateProjection(proj);
	   $.check(proj.records.size === 22);
	}

	test_derived_partial_projection_updates = function ({continent_city, city, country}) {
	   let proj = $.projectionFor(continent_city, {continent: 'America'});
	   proj.refCount += 1;

	   let f_newyork = {country: 'USA', name: 'New York', population: 20}
	   $.addFact(city, f_newyork);
	   $.updateProjection(proj);
	   
	   $.check($.isLike(
	      proj.records,
	      [
	         {city: 'Toronto'},
	         {city: 'Montreal'},
	         {city: 'Vancouver'},
	         {city: 'New York'}
	      ]
	   ));

	   let f_canada = $.find(country.records, rec => rec.name === 'Canada');
	   $.removeFact(country, f_canada);
	   $.updateProjection(proj);

	   $.check($.isLike(
	      proj.records,
	      [
	         {city: 'New York'}
	      ]
	   ));

	   $.releaseProjection(proj);
	}
	test_derived_scalar_updates = function ({continent_city, city}) {
	   let proj = $.projectionFor(continent_city, {continent: 'America', city: 'Toronto'});
	   proj.refCount += 1;

	   $.check(proj.records.size === 1);

	   let f_toronto = $.find(city.records, rec => rec.name === 'Toronto');
	   $.removeFact(city, f_toronto);
	   $.updateProjection(proj);

	   $.check(proj.records.size === 0);

	   $.addFact(city, f_toronto);
	   $.updateProjection(proj);

	   $.check(proj.records.size === 1);
	}

	test_derived_of_derived_updates = function ({continent_pop, city}) {
	   let proj = $.projectionFor(continent_pop, {continent: 'America'});
	   proj.refCount += 1;

	   $.check($.isLike(
	      proj.records,
	      [
	         {pop: 6.417},
	         {pop: 4.247},
	         {pop: 2.463},
	      ]
	   ));

	   let f_newyork = {country: 'USA', name: 'New York', population: 20};
	   $.addFact(city, f_newyork);
	   $.updateProjection(proj);

	   $.check($.isLike(
	      proj.records,
	      [
	         {pop: 6.417},
	         {pop: 4.247},
	         {pop: 2.463},
	         {pop: 20}
	      ]
	   ));

	   $.removeFact(city, f_newyork);
	   $.updateProjection(proj);

	   $.check($.isLike(
	      proj.records,
	      [
	         {pop: 6.417},
	         {pop: 4.247},
	         {pop: 2.463},
	      ]
	   ));
	}
}
