common
   check
   isLike
   find
   sortedArray
dedb-query
   query
dedb-projection
   projectionFor
   releaseProjection
   isFullBaseProjection
   updateProjection
dedb-base
   baseRelation
   addFact
   removeFact
   changeFact
dedb-derived
   derivedRelation
dedb-index
   indexOn
dedb-rec-key
   recKey
   recVal
-----
setup ::= function () {
   let
      // These 'name' property is just for ease of display/debug
      joe = {dev: 'joe', order: 1},
      jack = {dev: 'jack', order: 2},
      jim = {dev: 'jim', order: 3},
      kelly = {dev: 'kelly', order: 4},
      stasy = {dev: 'stasy', order: 5},
      greg = {dev: 'greg', order: 6};

   let
      company_J = {company: 'J systems'},
      company_C = {company: 'C systems'},
      company_P = {company: 'P systems'};

   let dev = $.baseRelation({
      name: 'dev',
      attrs: [$.recKey, 'company', 'name'],
      indices: [
         $.indexOn(['company'])
      ],
      records: [
         [joe, {company: company_J, name: 'joe'}],
         [jack, {company: company_J, name: 'jack'}],
         [jim, {company: company_C, name: 'joe'}],
         [kelly, {company: company_C, name: 'kelly'}],
         [stasy, {company: company_C, name: 'stasy'}],
         [greg, {company: company_P, name: 'joe'}],
      ],
   });

   let company = $.baseRelation({
      name: 'company',
      attrs: [$.recKey, 'name', 'lang'],
      indices: [
         $.indexOn(['name'], {isUnique: true}),
      ],
      records: [
         [company_J, {name: 'J systems', lang: 'java'}],
         [company_C, {name: 'C systems', lang: 'cpp'}],
         [company_P, {name: 'P systems', lang: 'php'}]
      ],
   });

   let dev_lang = $.derivedRelation({
      name: 'dev_lang',
      attrs: [$.recKey, $.recVal],
      indices: [],
      body: v => [
         dev.at({[$.recKey]: v.recKey, company: v`company`}),
         company.at({[$.recKey]: v`company`, lang: v.recVal}),
      ]
   });

   return {
      dev, company, dev_lang,
      company_J, company_C, company_P,
      joe, jack, jim, kelly, stasy, greg,
   };
}
test_query ::= function ({
   dev_lang,
   joe, jack, jim, kelly, stasy, greg,
}) {
   $.check($.isLike(
      $.query(dev_lang, {}),
      [
         [joe, 'java'],
         [jack, 'java'],
         [jim, 'cpp'],
         [kelly, 'cpp'],
         [stasy, 'cpp'],
         [greg, 'php'],
      ]
   ));
}
test_update_dev ::= function ({
   dev, company,
   dev_lang,
   joe, jack, jim, kelly, stasy, greg,
   company_P,
}) {
   let proj = $.projectionFor(dev_lang, {});

   $.changeFact(dev, stasy, {company: company_P, name: 'stasy'});
   $.updateProjection(proj);

   $.check($.isLike(
      $.sortedArray(proj.records, ([dev]) => dev.order),
      [
         [joe, 'java'],
         [jack, 'java'],
         [jim, 'cpp'],
         [kelly, 'cpp'],
         [stasy, 'php'],
         [greg, 'php'],
      ]
   ));
}
test_update_company ::= function ({
   dev, company,
   dev_lang,
   joe, jack, jim, kelly, stasy, greg,
   company_C, company_P, company_J,
}) {
   let proj = $.projectionFor(dev_lang, {});

   $.changeFact(company, company_J, {name: "J systems", lang: 'js'});
   $.changeFact(company, company_C, {name: "C systems", lang: 'objc'});
   $.updateProjection(proj);

   $.check($.isLike(
      $.sortedArray(proj.records, ([dev]) => dev.order),
      [
         [joe, 'js'],
         [jack, 'js'],
         [jim, 'objc'],
         [kelly, 'objc'],
         [stasy, 'objc'],
         [greg, 'php'],
      ]
   ));
}