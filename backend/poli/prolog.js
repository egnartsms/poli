prolog-projection
   projectionFor
   releaseProjection
   updateProjection
prolog-fact
   factualRelation
   removeFact
prolog-infer
   inferredRelation
prolog-update-scheme
   visualizeIncrementalUpdateScheme
-----
relations ::= ({})
initialize ::= function () {
   let f_europe;
   let continent = $.factualRelation({
      name: 'continent',
      attrs: ['name'],
      indices: [
         Object.assign(['name'], {isUnique: true})
      ],
      facts: new Set([
         f_europe = {name: 'Europe'},
         {name: 'Asia'},
         {name: 'America'}
      ]),
   });

   let f_ruthenia;

   let country = $.factualRelation({
      name: 'country',
      attrs: ['name', 'continent'],
      indices: [
         Object.assign(['name'], {isUnique: true}),
         // ['name'],
         ['continent']
      ],
      facts: new Set([
         {continent: 'Europe', name: 'France'},
         {continent: 'Europe', name: 'Poland'},
         f_ruthenia = {continent: 'Europe', name: 'Ruthenia'},
         {continent: 'Asia', name: 'China'},
         {continent: 'Asia', name: 'India'},
         {continent: 'Asia', name: 'Turkey'},
         {continent: 'America', name: 'Canada'},
         {continent: 'America', name: 'USA'}
      ]),
   });

   let f_dnipro;
   let city = $.factualRelation({
      name: 'city',
      attrs: ['name', 'country', 'population'],
      indices: [
         ['country']
      ],
      facts: new Set([
         {country: 'France', name: 'Paris', population: 13.024},
         {country: 'France', name: 'Marseille', population: 1.761},
         {country: 'France', name: 'Lyon', population: 2.323},

         {country: 'Poland', name: 'Warsaw', population: 3.100},
         {country: 'Poland', name: 'Wroclaw', population: 1.250},
         {country: 'Poland', name: 'Krakow', population: 1.725},

         {country: 'Ruthenia', name: 'Kyiv', population: 3.375},
         {country: 'Ruthenia', name: 'Lviv', population: 0.720},
         f_dnipro = {country: 'Ruthenia', name: 'Dnipro', population: 0.993},

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
         {country: 'Canada', name: 'Vancouver', population: 2.463}
      ])
   });

   let continent_city = $.inferredRelation(v => ({
      name: 'continent_city',
      attrs: ['continent', 'city'],
      body: [
         {
            rel: continent,
            attrs: {name: v`continent`}
         },
         {
            rel: country,
            attrs: {continent: v`continent`, name: v`country`}
         },
         {
            rel: city,
            attrs: {country: v`country`, name: v`city`}
         }
      ]
   }));

   // let ord_order = $.factualRelation({
   //    name: 'ord_order',
   //    attrs: ['id', 'created', 'profile_revision_id'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true}),
   //       ['profile_revision_id']
   //    ],
   //    facts: new Set
   // });
   // let cli_profile_revision = $.factualRelation({
   //    name: 'cli_profile_revision',
   //    attrs: ['id', 'email', 'first_name', 'last_name'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true})
   //    ],
   //    facts: new Set
   // });
   // let ord_orderline = $.factualRelation({
   //    name: 'ord_orderline',
   //    attrs: ['id', 'order_id', 'product_id'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true}),
   //       ['order_id'],
   //       ['product_id']
   //    ],
   //    facts: new Set
   // });
   // let prd_product = $.factualRelation({
   //    name: 'prd_product',
   //    attrs: ['id', 'name_id', 'subtitle_id'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true}),
   //       ['name_id'],
   //       ['subtitle_id']
   //    ],
   //    facts: new Set
   // });
   // let core_dict_word = $.factualRelation({
   //    name: 'core_dict_word',
   //    attrs: ['id', 'en', 'fr', 'ru'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true})
   //    ],
   //    facts: new Set
   // });
   // let tkt_ticket = $.factualRelation({
   //    name: 'tkt_ticket',
   //    attrs: ['id', 'code_id', 'profile_revision_id'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true}),
   //       Object.assign(['code_id'], {isUnique: true}),
   //       ['profile_revision_id']
   //    ],
   //    facts: new Set
   // });
   // let tkt_code = $.factualRelation({
   //    name: 'tkt_code',
   //    attrs: ['id', 'code', 'orderline_id', 'invalidated_on', 'invalidating_user_id'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true}),
   //       ['orderline_id'],
   //       ['invalidating_user_id']
   //    ],
   //    facts: new Set
   // });
   // let authbo_user = $.factualRelation({
   //    name: 'authbo_user',
   //    attrs: ['id', 'email', 'first_name', 'last_name'],
   //    indices: [
   //       Object.assign(['id'], {isUnique: true})
   //    ],
   //    facts: new Set
   // });

   // let canceled_barcodes = $.inferredRelation(v => ({
   //    name: 'canceled_barcodes',
   //    attrs: [
   //       'order_id',
   //       'order_created',
   //       'buyer_first_name',
   //       'buyer_last_name',
   //       'buyer_email',
   //       'product_name',
   //       'product_subtitle',
   //       'barcode',
   //       'ticket_first_name',
   //       'ticket_last_name',
   //       'ticket_email',
   //       'invalidation_date',
   //       'invalidating_user_first_name',
   //       'invalidating_user_last_name',
   //       'invalidating_user_email'
   //    ],
   //    body: [
   //       {
   //          rel: ord_order,
   //          attrs: {
   //             id: v`order_id`,
   //             created: v`order_created`,
   //             profile_revision_id: v`opr_id`
   //          }
   //       },
   //       {
   //          rel: cli_profile_revision,
   //          attrs: {
   //             id: v`opr_id`,
   //             first_name: v`buyer_first_name`,
   //             last_name: v`buyer_last_name`,
   //             email: v`buyer_email`
   //          }
   //       },
   //       {
   //          rel: ord_orderline,
   //          attrs: {
   //             id: v`orderline_id`,
   //             order_id: v`order_id`,
   //             product_id: v`product_id`
   //          }
   //       },
   //       {
   //          rel: prd_product,
   //          attrs: {
   //             id: v`product_id`,
   //             name_id: v`product_name_id`,
   //             subtitle_id: v`product_subtitle_id`
   //          }
   //       },
   //       {
   //          rel: core_dict_word,
   //          attrs: {
   //             id: v`product_name_id`,
   //             en: v`product_name`
   //          }
   //       },
   //       {
   //          rel: core_dict_word,
   //          attrs: {
   //             id: v`product_subtitle_id`,
   //             en: v`product_subtitle`
   //          }
   //       },
   //       {
   //          rel: tkt_code,
   //          attrs: {
   //             id: v`code_id`,
   //             code: v`barcode`,
   //             orderline_id: v`orderline_id`,
   //             invalidating_user_id: v`inv_user_id`,
   //             invalidated_on: v`invalidation_date`
   //          }
   //       },
   //       {
   //          rel: tkt_ticket,
   //          attrs: {
   //             code_id: v`code_id`,
   //             profile_revision_id: v`tpr_id`
   //          }
   //       },
   //       {
   //          rel: cli_profile_revision,
   //          attrs: {
   //             id: v`tpr_id`,
   //             first_name: v`ticket_first_name`,
   //             last_name: v`ticket_last_name`,
   //             email: v`ticket_email`,
   //          }
   //       },
   //       {
   //          rel: authbo_user,
   //          attrs: {
   //             id: v`inv_user_id`,
   //             first_name: v`invalidating_user_first_name`,
   //             last_name: v`invalidating_user_last_name`,
   //             email: v`invalidating_user_email`
   //          }
   //       }
   //    ]
   // }));

   Object.assign($.relations, {continent, country, city, continent_city});

   $.visualizeIncrementalUpdateScheme(continent_city);

   let proj = $.projectionFor(continent_city, {});
   proj.refcount += 1;

   console.log(Array.from(proj.value));

   $.removeFact(country, f_ruthenia);
   // $.removeFact(continent, f_europe);
   $.removeFact(city, f_dnipro);
   $.updateProjection(proj);

   console.log(Array.from(proj.value));   
   
   $.releaseProjection(proj);
   
}
