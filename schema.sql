pragma foreign_keys = yes;

create table module(
    id integer primary key,
    name text not null
);

create table entry(
    module_id integer not null references module(id),
    name text not null,
    def json not null,
    primary key (module_id, name)
);
