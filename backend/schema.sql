create table module(
   name text primary key
);


create table entry(
   module_name text not null,
   name not null,
   def json not null,
   prev text,
   primary key (module_name, name),
   foreign key (module_name) references module on update cascade,
   foreign key (module_name, prev) references entry on update cascade
);


create table import(
   recp_module_name text not null,
   donor_module_name text not null,
   name text not null,
   alias text,
   primary key (recp_module_name, donor_module_name, name),
   foreign key (recp_module_name) references module on update cascade,
   foreign key (donor_module_name) references module on update cascade,
   foreign key (donor_module_name, name) references entry
      on update cascade on delete cascade
);


create table star_import(
   recp_module_name text not null,
   donor_module_name text not null,
   alias text not null,
   foreign key (recp_module_name) references module on update cascade,
   foreign key (donor_module_name) references module on update cascade
);


create view any_import as
   select
      recp_module_name,
      donor_module_name,
      name,
      alias
   from import

   union all
   
   select
      recp_module_name,
      donor_module_name,
      null as name,
      alias
   from star_import

   order by 1, 2, 3
;
