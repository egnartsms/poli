common
   check
   checkLike
   isLike
   find
   sortedArray
dedb-goal
   join
dedb-base
   addFact
   makeEntity
   removeEntity
   patchEntity
dedb-projection
   updateProjection
dedb-query
   queryOne
   valueAt
   getDerivedProjection
dedb-rec-key
   recKey
-----
dev ::= ({
   name: 'dev',
   isKeyed: true,
   isEntity: true,
   attrs: ['name', 'company'],
   indices: [
      ['company']
   ]
})
company ::= ({
   name: 'company',
   isKeyed: false,
   attrs: ['name', 'salary'],
   indices: [
      ['name', 1]
   ],
   records: [
      {name: 'SoftServe', salary: 2500},
      {name: 'GlobalLogic', salary: 2800},
      {name: 'LuxSoft', salary: 3000},
      {name: 'DataArt', salary: 3300},
      {name: 'SiteCore', salary: 4000},
      {name: 'Ciklum', salary: 4400}
   ],
})
devSalary ::= ({
   name: 'devSalary',
   isKeyed: true,
   body: v => [
      $.join($.dev, v.key, {company: v`company`}),
      $.join($.company, {name: v`company`, salary: v.value})
   ]
})
devCompany ::= ({
   name: 'devCompany',
   isKeyed: true,
   body: v => [
      $.join($.dev, v.key, {company: v`company`}),
      $.join($.company, v.value, {name: v`company`})
   ]   
})
test_basic ::= function () {
   let joe = $.makeEntity($.dev, {name: 'Joe', company: 'DataArt'});
   $.check($.valueAt($.devSalary, joe) === 3300);

   $.patchEntity(joe, val => ({...val, company: 'Ciklum'}));
   $.check($.valueAt($.devSalary, joe) === 4400);

   $.removeEntity(joe);
   $.check($.valueAt($.devSalary, joe) === undefined);
}
test_partial ::= function () {
   let joe = $.makeEntity($.dev, {name: 'Joe', company: 'DataArt'});
   let jim = $.makeEntity($.dev, {name: 'Jim', company: 'GlobalLogic'});
   let jay = $.makeEntity($.dev, {name: 'Jay', company: 'SoftServe'});
   let val;

   let proj = $.getDerivedProjection($.devSalary, {[$.recKey]: jim});

   $.check(proj.records.size === 1);
   [[, val]] = proj.records;
   $.check(val === 2800);

   $.patchEntity(jim, val => ({...val, company: 'Ciklum'}));
   $.updateProjection(proj);
   [[, val]] = proj.records;
   $.check(val === 4400);
}
test_grab_fact_identity ::= function () {
   let joe = $.makeEntity($.dev, {name: 'Joe', company: 'DataArt'});
   let jim = $.makeEntity($.dev, {name: 'Jim', company: 'GlobalLogic'});
   let jay = $.makeEntity($.dev, {name: 'Jay', company: 'SoftServe'});

   $.checkLike($.valueAt($.devCompany, joe), {name: 'DataArt', salary: 3300});
   $.checkLike($.valueAt($.devCompany, jim), {name: 'GlobalLogic', salary: 2800});
   $.checkLike($.valueAt($.devCompany, jay), {name: 'SoftServe', salary: 2500});
}